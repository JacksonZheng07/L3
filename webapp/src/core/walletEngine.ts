import { Mint, Wallet, MintQuoteState } from '@cashu/cashu-ts';
import type { Proof } from '@cashu/cashu-ts';
import { MINTS } from './config';
import type { WalletBalance, MigrationEvent } from '../state/types';

// ── Result helpers ──────────────────────────────────────────────────
interface Success<T> { ok: true; data: T }
interface Failure     { ok: false; error: string }
type Result<T> = Success<T> | Failure;

function success<T>(data: T): Success<T> { return { ok: true, data }; }
function failure(error: string): Failure  { return { ok: false, error }; }

// ── localStorage helpers ────────────────────────────────────────────
const STORAGE_KEY = 'l3_wallet_proofs';

function loadProofsFromStorage(): Map<string, Proof[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj: Record<string, Proof[]> = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveProofsToStorage(proofs: Map<string, Proof[]>): void {
  try {
    const obj: Record<string, Proof[]> = {};
    for (const [url, p] of proofs) {
      obj[url] = p;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // silently ignore storage errors (e.g. quota exceeded)
  }
}

// ── Mint-name lookup ────────────────────────────────────────────────
function mintName(url: string): string {
  const entry = MINTS.find((m) => m.url === url);
  return entry?.name ?? url;
}

// ── WalletEngine ────────────────────────────────────────────────────
class WalletEngine {
  private mints   = new Map<string, InstanceType<typeof Mint>>();
  private wallets = new Map<string, InstanceType<typeof Wallet>>();
  private proofs  = new Map<string, Proof[]>();

  private initialized = false;

  // ── Init ────────────────────────────────────────────────────────
  async initialize(): Promise<Result<void>> {
    if (this.initialized) return success(undefined);
    try {
      this.proofs = loadProofsFromStorage();

      const initTasks = MINTS.map(async (cfg) => {
        const mint   = new Mint(cfg.url);
        const wallet = new Wallet(mint);
        await wallet.loadMint();

        this.mints.set(cfg.url, mint);
        this.wallets.set(cfg.url, wallet);

        // ensure proofs map has an entry for every mint
        if (!this.proofs.has(cfg.url)) {
          this.proofs.set(cfg.url, []);
        }
      });

      // initialize all mints in parallel; don't let one failure block the rest
      const results = await Promise.allSettled(initTasks);
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `[WalletEngine] ${failures.length}/${MINTS.length} mints failed to init`,
          failures.map((f) => (f as PromiseRejectedResult).reason),
        );
      }

      this.initialized = true;
      return success(undefined);
    } catch (err) {
      return failure(`Initialization failed: ${String(err)}`);
    }
  }

  // ── Balance queries ─────────────────────────────────────────────
  getBalance(mintUrl: string): number {
    const proofs = this.proofs.get(mintUrl) ?? [];
    return proofs.reduce((sum, p) => sum + p.amount, 0);
  }

  getTotalBalance(): number {
    let total = 0;
    for (const [url] of this.proofs) {
      total += this.getBalance(url);
    }
    return total;
  }

  getAllBalances(): WalletBalance[] {
    const balances: WalletBalance[] = [];
    for (const [url, proofs] of this.proofs) {
      const balance = proofs.reduce((sum, p) => sum + p.amount, 0);
      if (balance > 0) {
        balances.push({ mintUrl: url, mintName: mintName(url), balance });
      }
    }
    return balances;
  }

  // ── Receive (mint ecash from Lightning) ─────────────────────────
  /**
   * Create a mint quote (Lightning invoice) for the given amount.
   * Returns the quote id and Lightning invoice (request).
   */
  async receive(
    mintUrl: string,
    amount: number,
  ): Promise<Result<{ quote: string; request: string }>> {
    try {
      const wallet = this.getWallet(mintUrl);
      const quoteRes = await wallet.createMintQuoteBolt11(amount);
      return success({ quote: quoteRes.quote, request: quoteRes.request });
    } catch (err) {
      return failure(`receive: ${String(err)}`);
    }
  }

  /**
   * Poll a mint quote until paid, then mint proofs and store them.
   * Polls every 3 seconds up to `maxAttempts` times (default 100 ~ 5 min).
   */
  async pollMintQuote(
    mintUrl: string,
    quoteId: string,
    maxAttempts = 100,
  ): Promise<Result<Proof[]>> {
    try {
      const wallet = this.getWallet(mintUrl);

      for (let i = 0; i < maxAttempts; i++) {
        const status = await wallet.checkMintQuoteBolt11(quoteId);

        if (status.state === MintQuoteState.PAID || status.state === MintQuoteState.ISSUED) {
          // Quote is paid — mint the proofs
          const newProofs = await wallet.mintProofsBolt11(status.amount, quoteId);
          this.addProofs(mintUrl, newProofs);
          return success(newProofs);
        }

        // Wait 3 seconds before next poll
        await sleep(3000);
      }

      return failure('pollMintQuote: timed out waiting for payment');
    } catch (err) {
      return failure(`pollMintQuote: ${String(err)}`);
    }
  }

  // ── Send (melt ecash to Lightning) ──────────────────────────────
  /**
   * Pay a Lightning invoice by melting proofs from the given mint.
   */
  async send(
    mintUrl: string,
    invoice: string,
  ): Promise<Result<{ paid: boolean; preimage: string | null }>> {
    try {
      const wallet = this.getWallet(mintUrl);
      const proofs = this.proofs.get(mintUrl) ?? [];

      // Get a melt quote to know the cost (amount + fee_reserve)
      const meltQuote = await wallet.createMeltQuoteBolt11(invoice);
      const needed = meltQuote.amount + meltQuote.fee_reserve;

      // Select proofs to cover the amount
      const { keep, send: toSend } = wallet.selectProofsToSend(proofs, needed, true);

      // Execute the melt
      const meltResult = await wallet.meltProofsBolt11(meltQuote, toSend);

      // Update stored proofs: keep the unspent proofs + any change
      const updatedProofs = [...keep, ...meltResult.change];
      this.proofs.set(mintUrl, updatedProofs);
      saveProofsToStorage(this.proofs);

      return success({
        paid: meltResult.quote.state === 'PAID',
        preimage: meltResult.quote.payment_preimage,
      });
    } catch (err) {
      return failure(`send: ${String(err)}`);
    }
  }

  // ── Migrate (move ecash between mints) ──────────────────────────
  /**
   * Cross-mint migration:
   *   1. Create mint quote on target (get Lightning invoice)
   *   2. Melt proofs on source (pay target's invoice)
   *   3. Mint proofs on target once paid
   */
  async migrate(
    fromMintUrl: string,
    toMintUrl: string,
    amount: number,
    reason = 'trust-score-migration',
  ): Promise<Result<MigrationEvent>> {
    const event: MigrationEvent = {
      id: crypto.randomUUID(),
      fromMint: fromMintUrl,
      toMint: toMintUrl,
      amount,
      reason,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    try {
      const sourceWallet = this.getWallet(fromMintUrl);
      const targetWallet = this.getWallet(toMintUrl);

      event.status = 'in_progress';

      // Step 1: Create a mint quote on the target mint
      const mintQuote = await targetWallet.createMintQuoteBolt11(amount);

      // Step 2: Melt proofs on the source mint to pay the target's invoice
      const sourceProofs = this.proofs.get(fromMintUrl) ?? [];
      const meltQuote = await sourceWallet.createMeltQuoteBolt11(mintQuote.request);
      const needed = meltQuote.amount + meltQuote.fee_reserve;
      const { keep, send: toSend } = sourceWallet.selectProofsToSend(sourceProofs, needed, true);

      const meltResult = await sourceWallet.meltProofsBolt11(meltQuote, toSend);

      // Update source proofs
      const updatedSourceProofs = [...keep, ...meltResult.change];
      this.proofs.set(fromMintUrl, updatedSourceProofs);
      saveProofsToStorage(this.proofs);

      // Step 3: Mint proofs on the target
      const newProofs = await targetWallet.mintProofsBolt11(amount, mintQuote.quote);
      this.addProofs(toMintUrl, newProofs);

      event.status = 'completed';
      return success(event);
    } catch (err) {
      event.status = 'failed';
      return failure(`migrate: ${String(err)}`);
    }
  }

  // ── Internal helpers ────────────────────────────────────────────
  private getWallet(mintUrl: string): InstanceType<typeof Wallet> {
    const w = this.wallets.get(mintUrl);
    if (!w) throw new Error(`No wallet initialised for ${mintUrl}`);
    return w;
  }

  private addProofs(mintUrl: string, newProofs: Proof[]): void {
    const existing = this.proofs.get(mintUrl) ?? [];
    this.proofs.set(mintUrl, [...existing, ...newProofs]);
    saveProofsToStorage(this.proofs);
  }
}

// ── Utility ─────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Singleton export ────────────────────────────────────────────────
export const walletEngine = new WalletEngine();
