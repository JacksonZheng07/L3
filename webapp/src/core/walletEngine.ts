import { Mint, Wallet, MintQuoteState } from '@cashu/cashu-ts';
import type { Proof } from '@cashu/cashu-ts';
import { MINTS } from './config';
import type { MintConfig, DemoMode, WalletBalance, MigrationEvent } from '../state/types';

// ── Result helpers ──────────────────────────────────────────────────
interface Success<T> { ok: true; data: T }
interface Failure     { ok: false; error: string }
type Result<T> = Success<T> | Failure;

function success<T>(data: T): Success<T> { return { ok: true, data }; }
function failure(error: string): Failure  { return { ok: false, error }; }

// ── localStorage helpers (mode-namespaced) ─────────────────────────
function storageKeyForMode(mode: DemoMode): string {
  return `l3_wallet_proofs_${mode}`;
}

function loadProofsFromStorage(mode: DemoMode): Map<string, Proof[]> {
  try {
    const raw = localStorage.getItem(storageKeyForMode(mode));
    if (!raw) return new Map();
    const obj: Record<string, Proof[]> = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveProofsToStorage(proofs: Map<string, Proof[]>, mode: DemoMode): void {
  try {
    const obj: Record<string, Proof[]> = {};
    for (const [url, p] of proofs) {
      obj[url] = p;
    }
    localStorage.setItem(storageKeyForMode(mode), JSON.stringify(obj));
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
  private currentMode: DemoMode = 'mock';
  // In-memory only — never serialized to localStorage
  private bip39seed: Uint8Array | undefined = undefined;
  // Tracks amount per mock quote so pollMintQuote can credit the right value
  private mockQuoteAmounts = new Map<string, number>();

  // ── Mode management ────────────────────────────────────────────
  getMode(): DemoMode {
    return this.currentMode;
  }

  hasSeed(): boolean {
    return this.bip39seed !== undefined;
  }

  /**
   * Switch the engine to a new demo mode with the appropriate mint configs.
   * - Saves current proofs, tears down connections, loads new mode's proofs.
   * - Mock mode: skips real mint init, seeds demo balances on first use.
   * - Testnet/mainnet: initializes only the filtered mints.
   * @param bip39seed Optional BIP-39 64-byte seed for deterministic ecash secrets.
   */
  async setMode(mode: DemoMode, mintConfigs: MintConfig[], bip39seed?: Uint8Array): Promise<Result<void>> {
    // Save current proofs before switching
    if (this.initialized) {
      saveProofsToStorage(this.proofs, this.currentMode);
    }

    // Reset internal state
    this.mints.clear();
    this.wallets.clear();
    this.proofs = new Map();
    this.initialized = false;
    this.currentMode = mode;
    if (bip39seed !== undefined) {
      this.bip39seed = bip39seed;
    }

    // Load proofs for the new mode
    this.proofs = loadProofsFromStorage(mode);

    if (mode === 'mock') {
      // Populate entries for each mint config (no real connections)
      for (const cfg of mintConfigs) {
        if (!this.proofs.has(cfg.url)) {
          this.proofs.set(cfg.url, []);
        }
      }
      // Seed demo balances on first use so mock mode is useful for demos
      const totalExisting = Array.from(this.proofs.values())
        .reduce((sum, p) => sum + p.reduce((s, proof) => s + proof.amount, 0), 0);
      if (totalExisting === 0) {
        const seedAmounts = [500, 300, 200, 100, 50];
        const urls = mintConfigs.map((c) => c.url);
        urls.forEach((url, i) => {
          if (i < seedAmounts.length) {
            this.proofs.set(url, [this.createMockProof(seedAmounts[i])]);
          }
        });
        saveProofsToStorage(this.proofs, 'mock');
      }
      this.initialized = true;
      return success(undefined);
    }

    // Testnet / mainnet: initialize real mint connections
    return this._initializeMints(mintConfigs);
  }

  // ── Init (real mints) ──────────────────────────────────────────
  /**
   * @deprecated Use setMode() instead. Kept for backward compatibility.
   */
  async initialize(): Promise<Result<void>> {
    return this.setMode('mainnet', MINTS);
  }

  private async _initializeMints(mintConfigs: MintConfig[]): Promise<Result<void>> {
    if (this.initialized) return success(undefined);
    try {
      const seed = this.bip39seed;
      const initTasks = mintConfigs.map(async (cfg) => {
        const mint   = new Mint(cfg.url);
        const wallet = seed
          ? new Wallet(mint, { bip39seed: seed })
          : new Wallet(mint);
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
          `[WalletEngine] ${failures.length}/${mintConfigs.length} mints failed to init`,
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
  async receive(
    mintUrl: string,
    amount: number,
  ): Promise<Result<{ quote: string; request: string }>> {
    if (this.currentMode === 'mock') {
      const quote = `mock-quote-${crypto.randomUUID()}`;
      this.mockQuoteAmounts.set(quote, amount);
      return success({
        quote,
        request: `lnbc${amount}u1mock${crypto.randomUUID().slice(0, 20)}`,
      });
    }
    try {
      const wallet = this.getWallet(mintUrl);
      const quoteRes = await wallet.createMintQuoteBolt11(amount);
      return success({ quote: quoteRes.quote, request: quoteRes.request });
    } catch (err) {
      return failure(`receive: ${String(err)}`);
    }
  }

  async pollMintQuote(
    mintUrl: string,
    quoteId: string,
    maxAttempts = 100,
  ): Promise<Result<Proof[]>> {
    if (this.currentMode === 'mock') {
      // Simulate network latency, then credit the originally requested amount
      await sleep(1500);
      const amount = this.mockQuoteAmounts.get(quoteId) ?? 100;
      this.mockQuoteAmounts.delete(quoteId);
      const newProofs = [this.createMockProof(amount)];
      this.addProofs(mintUrl, newProofs);
      return success(newProofs);
    }
    try {
      const wallet = this.getWallet(mintUrl);

      for (let i = 0; i < maxAttempts; i++) {
        const status = await wallet.checkMintQuoteBolt11(quoteId);

        if (status.state === MintQuoteState.PAID || status.state === MintQuoteState.ISSUED) {
          const newProofs = await wallet.mintProofsBolt11(status.amount, quoteId);
          this.addProofs(mintUrl, newProofs);
          return success(newProofs);
        }

        await sleep(3000);
      }

      return failure('pollMintQuote: timed out waiting for payment');
    } catch (err) {
      return failure(`pollMintQuote: ${String(err)}`);
    }
  }

  // ── Send (melt ecash to Lightning) ──────────────────────────────
  async send(
    mintUrl: string,
    invoice: string,
  ): Promise<Result<{ paid: boolean; preimage: string | null }>> {
    if (this.currentMode === 'mock') {
      return this.mockSend(mintUrl);
    }
    try {
      const wallet = this.getWallet(mintUrl);
      const proofs = this.proofs.get(mintUrl) ?? [];

      const meltQuote = await wallet.createMeltQuoteBolt11(invoice);
      const needed = meltQuote.amount + meltQuote.fee_reserve;
      const { keep, send: toSend } = wallet.selectProofsToSend(proofs, needed, true);
      const meltResult = await wallet.meltProofsBolt11(meltQuote, toSend);

      const updatedProofs = [...keep, ...meltResult.change];
      this.proofs.set(mintUrl, updatedProofs);
      saveProofsToStorage(this.proofs, this.currentMode);

      return success({
        paid: meltResult.quote.state === 'PAID',
        preimage: meltResult.quote.payment_preimage,
      });
    } catch (err) {
      return failure(`send: ${String(err)}`);
    }
  }

  // ── Migrate (move ecash between mints) ──────────────────────────
  async migrate(
    fromMintUrl: string,
    toMintUrl: string,
    amount: number,
    reason = 'trust-score-migration',
  ): Promise<Result<MigrationEvent>> {
    if (this.currentMode === 'mock') {
      return this.mockMigrate(fromMintUrl, toMintUrl, amount, reason);
    }

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

      const mintQuote = await targetWallet.createMintQuoteBolt11(amount);

      const sourceProofs = this.proofs.get(fromMintUrl) ?? [];
      const meltQuote = await sourceWallet.createMeltQuoteBolt11(mintQuote.request);
      const needed = meltQuote.amount + meltQuote.fee_reserve;
      const { keep, send: toSend } = sourceWallet.selectProofsToSend(sourceProofs, needed, true);

      const meltResult = await sourceWallet.meltProofsBolt11(meltQuote, toSend);

      const updatedSourceProofs = [...keep, ...meltResult.change];
      this.proofs.set(fromMintUrl, updatedSourceProofs);
      saveProofsToStorage(this.proofs, this.currentMode);

      const newProofs = await targetWallet.mintProofsBolt11(amount, mintQuote.quote);
      this.addProofs(toMintUrl, newProofs);

      event.status = 'completed';
      return success(event);
    } catch (err) {
      event.status = 'failed';
      return failure(`migrate: ${String(err)}`);
    }
  }

  // ── Mock operation helpers ─────────────────────────────────────
  private createMockProof(amount: number): Proof {
    return {
      id: 'mock-keyset',
      amount,
      secret: `mock-secret-${crypto.randomUUID()}`,
      C: `mock-C-${crypto.randomUUID()}`,
    } as Proof;
  }

  private mockSend(mintUrl: string): Result<{ paid: boolean; preimage: string | null }> {
    const proofs = this.proofs.get(mintUrl) ?? [];
    if (proofs.length === 0) {
      return failure('mock send: no proofs available');
    }
    // Remove one proof to simulate spending
    const [, ...remaining] = proofs;
    this.proofs.set(mintUrl, remaining);
    saveProofsToStorage(this.proofs, this.currentMode);
    return success({ paid: true, preimage: `mock-preimage-${crypto.randomUUID()}` });
  }

  private mockMigrate(
    fromMintUrl: string,
    toMintUrl: string,
    amount: number,
    reason: string,
  ): Result<MigrationEvent> {
    const fromProofs = this.proofs.get(fromMintUrl) ?? [];
    const fromBalance = fromProofs.reduce((s, p) => s + p.amount, 0);
    if (fromBalance < amount) {
      return failure(`mock migrate: insufficient balance (${fromBalance} < ${amount})`);
    }

    // Deduct from source: remove proofs until we've covered the amount
    let remaining = amount;
    const keptProofs: Proof[] = [];
    for (const p of fromProofs) {
      if (remaining > 0) {
        remaining -= p.amount;
        // If we over-deducted, create change proof
        if (remaining < 0) {
          keptProofs.push(this.createMockProof(-remaining));
        }
      } else {
        keptProofs.push(p);
      }
    }
    this.proofs.set(fromMintUrl, keptProofs);

    // Credit to target
    const toProofs = this.proofs.get(toMintUrl) ?? [];
    this.proofs.set(toMintUrl, [...toProofs, this.createMockProof(amount)]);
    saveProofsToStorage(this.proofs, this.currentMode);

    return success({
      id: crypto.randomUUID(),
      fromMint: fromMintUrl,
      toMint: toMintUrl,
      amount,
      reason,
      timestamp: new Date().toISOString(),
      status: 'completed',
    });
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
    saveProofsToStorage(this.proofs, this.currentMode);
  }
}

// ── Utility ─────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Singleton export ────────────────────────────────────────────────
export const walletEngine = new WalletEngine();
