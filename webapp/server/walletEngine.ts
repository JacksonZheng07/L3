import { Mint, Wallet, MintQuoteState } from '@cashu/cashu-ts';
import type { Proof } from '@cashu/cashu-ts';
import fs from 'fs';
import path from 'path';
import { MINTS } from './config.js';
import type { MintConfig, DemoMode, WalletBalance, MigrationEvent, MintScore } from '../src/state/types.js';

// ── Result helpers ──────────────────────────────────────────────────
interface Success<T> { ok: true; data: T }
interface Failure     { ok: false; error: string }
type Result<T> = Success<T> | Failure;

function success<T>(data: T): Success<T> { return { ok: true, data }; }
function failure(error: string): Failure  { return { ok: false, error }; }

// ── File-based proof storage ────────────────────────────────────────
const DATA_DIR = path.resolve(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function proofFilePath(mode: DemoMode): string {
  return path.join(DATA_DIR, `proofs_${mode}.json`);
}

function loadProofsFromFile(mode: DemoMode): Map<string, Proof[]> {
  try {
    const filePath = proofFilePath(mode);
    if (!fs.existsSync(filePath)) return new Map();
    const raw = fs.readFileSync(filePath, 'utf-8');
    const obj: Record<string, Proof[]> = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveProofsToFile(proofs: Map<string, Proof[]>, mode: DemoMode): void {
  try {
    ensureDataDir();
    const obj: Record<string, Proof[]> = {};
    for (const [url, p] of proofs) {
      obj[url] = p;
    }
    fs.writeFileSync(proofFilePath(mode), JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('[WalletEngine] Failed to save proofs:', err);
  }
}

// ── Mint-name lookup ────────────────────────────────────────────────
function mintName(url: string): string {
  const entry = MINTS.find((m) => m.url === url);
  return entry?.name ?? url;
}

// ── WalletEngine (server-side) ──────────────────────────────────────
class WalletEngine {
  private mints   = new Map<string, InstanceType<typeof Mint>>();
  private wallets = new Map<string, InstanceType<typeof Wallet>>();
  private proofs  = new Map<string, Proof[]>();

  private initialized = false;
  private currentMode: DemoMode = 'mutinynet';

  // ── Mode management ────────────────────────────────────────────
  getMode(): DemoMode {
    return this.currentMode;
  }

  async setMode(mode: DemoMode, mintConfigs: MintConfig[]): Promise<Result<void>> {
    // Save current proofs before switching
    if (this.initialized) {
      saveProofsToFile(this.proofs, this.currentMode);
    }

    // Reset internal state
    this.mints.clear();
    this.wallets.clear();
    this.proofs = new Map();
    this.initialized = false;
    this.currentMode = mode;

    // Load proofs for the new mode
    this.proofs = loadProofsFromFile(mode);

    return this._initializeMints(mintConfigs);
  }

  private async _initializeMints(mintConfigs: MintConfig[]): Promise<Result<void>> {
    if (this.initialized) return success(undefined);
    try {
      console.log(`[WalletEngine] Initializing ${mintConfigs.length} mints (mode=${this.currentMode})…`);

      const initTasks = mintConfigs.map(async (cfg) => {
        // Server-side: use real URLs directly (no CORS issue)
        console.log(`[WalletEngine] init ${cfg.name || cfg.url}`);

        const mint   = new Mint(cfg.url);
        const wallet = new Wallet(mint);
        await wallet.loadMint();

        this.mints.set(cfg.url, mint);
        this.wallets.set(cfg.url, wallet);

        if (!this.proofs.has(cfg.url)) {
          this.proofs.set(cfg.url, []);
        }

        console.log(`[WalletEngine] ✓ ${cfg.name || cfg.url} connected`);
      });

      const results = await Promise.allSettled(initTasks);
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `[WalletEngine] ${failures.length}/${mintConfigs.length} mints failed to init:`,
          failures.map((f) => (f as PromiseRejectedResult).reason),
        );
      }

      const succeeded = mintConfigs.length - failures.length;
      console.log(`[WalletEngine] Init complete: ${succeeded}/${mintConfigs.length} mints connected`);

      this.initialized = true;
      return success(undefined);
    } catch (err) {
      console.error(`[WalletEngine] Init failed:`, err);
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
    console.log(`[WalletEngine] receive: ${amount} sats from ${mintName(mintUrl)} (${mintUrl})`);
    try {
      const wallet = this.getWallet(mintUrl);
      const quoteRes = await wallet.createMintQuoteBolt11(amount);
      console.log(`[WalletEngine] receive: invoice generated, quote=${quoteRes.quote.slice(0, 12)}…`);
      return success({ quote: quoteRes.quote, request: quoteRes.request });
    } catch (err) {
      console.error(`[WalletEngine] receive FAILED:`, err);
      return failure(`receive: ${String(err)}`);
    }
  }

  async smartReceive(
    amount: number,
    scores: MintScore[],
  ): Promise<Result<{ quote: string; request: string; mintUrl: string }>> {
    const eligible = scores
      .filter((s) => s.isOnline && s.grade !== 'critical' && this.wallets.has(s.url))
      .sort((a, b) => b.compositeScore - a.compositeScore);

    if (eligible.length > 0) {
      console.log(`[WalletEngine] smartReceive: ${amount} sats, ${eligible.length} eligible mints, best=${eligible[0].name} (score ${eligible[0].compositeScore.toFixed(0)})`);

      for (const mint of eligible) {
        const result = await this.receive(mint.url, amount);
        if (result.ok) {
          console.log(`[WalletEngine] smartReceive: selected ${mint.name} (score ${mint.compositeScore.toFixed(0)})`);
          return success({ ...result.data, mintUrl: mint.url });
        }
      }
    }

    // Fallback: no scores yet — try any connected wallet
    const connected = Array.from(this.wallets.keys());
    if (connected.length > 0) {
      console.log(`[WalletEngine] smartReceive: no scored mints, falling back to ${connected.length} connected wallet(s)`);
      for (const url of connected) {
        const result = await this.receive(url, amount);
        if (result.ok) {
          console.log(`[WalletEngine] smartReceive: fallback to ${mintName(url)}`);
          return success({ ...result.data, mintUrl: url });
        }
      }
    }

    return failure('smartReceive: no connected mints — connect a wallet first');
  }

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
          const newProofs = await wallet.mintProofsBolt11(status.amount, quoteId);
          this.addProofs(mintUrl, newProofs);
          const total = newProofs.reduce((s, p) => s + p.amount, 0);
          console.log(`[WalletEngine] pollMintQuote: PAID ✓ — minted ${total} sats on ${mintName(mintUrl)}, ${newProofs.length} proofs`);
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
    console.log(`[WalletEngine] send: melting from ${mintName(mintUrl)}, invoice=${invoice.slice(0, 30)}…`);
    try {
      const wallet = this.getWallet(mintUrl);
      const proofs = this.proofs.get(mintUrl) ?? [];

      const meltQuote = await wallet.createMeltQuoteBolt11(invoice);
      const needed = meltQuote.amount + meltQuote.fee_reserve;
      console.log(`[WalletEngine] send: need ${needed} sats (${meltQuote.amount} + ${meltQuote.fee_reserve} fee), have ${proofs.reduce((s, p) => s + p.amount, 0)}`);
      const { keep, send: toSend } = wallet.selectProofsToSend(proofs, needed, true);
      const meltResult = await wallet.meltProofsBolt11(meltQuote, toSend);

      const updatedProofs = [...keep, ...meltResult.change];
      this.proofs.set(mintUrl, updatedProofs);
      saveProofsToFile(this.proofs, this.currentMode);

      const paid = meltResult.quote.state === 'PAID';
      console.log(`[WalletEngine] send: ${paid ? 'PAID ✓' : 'FAILED ✗'} — preimage=${meltResult.quote.payment_preimage?.slice(0, 16) ?? 'none'}…`);

      return success({
        paid,
        preimage: meltResult.quote.payment_preimage,
      });
    } catch (err) {
      console.error(`[WalletEngine] send FAILED:`, err);
      return failure(`send: ${String(err)}`);
    }
  }

  async smartSend(
    invoice: string,
    scores: MintScore[],
  ): Promise<Result<{ paid: boolean; preimage: string | null; usedMints: string[] }>> {
    const ranked = scores
      .filter((s) => s.isOnline && this.wallets.has(s.url))
      .sort((a, b) => b.compositeScore - a.compositeScore);

    if (ranked.length === 0) {
      return failure('smartSend: no eligible online mints');
    }

    const fundedMints: { url: string; balance: number; score: number }[] = [];
    for (const s of ranked) {
      const bal = this.getBalance(s.url);
      if (bal > 0) {
        fundedMints.push({ url: s.url, balance: bal, score: s.compositeScore });
      }
    }

    if (fundedMints.length === 0) {
      return failure('smartSend: no mints have funds');
    }

    console.log(`[WalletEngine] smartSend: ${fundedMints.length} funded mints:`,
      fundedMints.map((m) => `${mintName(m.url)} (score ${m.score.toFixed(0)}, ${m.balance} sats)`));

    let estimatedCost = 0;
    for (const m of fundedMints) {
      try {
        const wallet = this.getWallet(m.url);
        const quote = await wallet.createMeltQuoteBolt11(invoice);
        estimatedCost = quote.amount + quote.fee_reserve;
        break;
      } catch {
        continue;
      }
    }

    if (estimatedCost === 0) {
      return failure('smartSend: could not get melt quote from any mint');
    }

    const totalAvailable = fundedMints.reduce((s, m) => s + m.balance, 0);
    if (totalAvailable < estimatedCost) {
      return failure(
        `smartSend: insufficient total balance (${totalAvailable} < ${estimatedCost} needed)`,
      );
    }

    // Try paying from the LEAST-trusted mint first (drain risky mints)
    const riskiestFirst = [...fundedMints].reverse();
    for (const m of riskiestFirst) {
      if (m.balance >= estimatedCost) {
        console.log(`[WalletEngine] smartSend: draining ${mintName(m.url)} (score ${m.score.toFixed(0)}, riskiest with enough balance)`);
        const result = await this.send(m.url, invoice);
        if (result.ok) {
          return success({ ...result.data, usedMints: [m.url] });
        }
      }
    }

    // Consolidate into safest mint then pay
    const safestMint = fundedMints[0];
    console.log(`[WalletEngine] smartSend: consolidating into ${mintName(safestMint.url)} (score ${safestMint.score.toFixed(0)}, safest)`);
    const needed = estimatedCost - safestMint.balance;
    let consolidated = 0;
    const usedMints = [safestMint.url];

    const donors = fundedMints.slice(1).reverse();
    for (const donor of donors) {
      if (consolidated >= needed) break;

      const contribution = Math.min(donor.balance, needed - consolidated);
      const migrateResult = await this.migrate(
        donor.url,
        safestMint.url,
        contribution,
        'smartSend-consolidation',
      );

      if (migrateResult.ok) {
        consolidated += contribution;
        usedMints.push(donor.url);
      }
    }

    const result = await this.send(safestMint.url, invoice);
    if (result.ok) {
      return success({ ...result.data, usedMints });
    }

    return failure(`smartSend: payment failed after consolidation: ${result.error}`);
  }

  // ── Migrate (move ecash between mints) ──────────────────────────
  async migrate(
    fromMintUrl: string,
    toMintUrl: string,
    amount: number,
    reason = 'trust-score-migration',
  ): Promise<Result<MigrationEvent>> {
    console.log(`[WalletEngine] migrate: ${amount} sats ${mintName(fromMintUrl)} → ${mintName(toMintUrl)} (${reason})`);
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
      saveProofsToFile(this.proofs, this.currentMode);

      const newProofs = await targetWallet.mintProofsBolt11(amount, mintQuote.quote);
      this.addProofs(toMintUrl, newProofs);

      event.status = 'completed';
      console.log(`[WalletEngine] migrate: DONE ✓ — ${amount} sats moved ${mintName(fromMintUrl)} → ${mintName(toMintUrl)}`);
      return success(event);
    } catch (err) {
      event.status = 'failed';
      console.error(`[WalletEngine] migrate FAILED:`, err);
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
    saveProofsToFile(this.proofs, this.currentMode);
  }
}

// ── Utility ─────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Singleton export ────────────────────────────────────────────────
export const walletEngine = new WalletEngine();
