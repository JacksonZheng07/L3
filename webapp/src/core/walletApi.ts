/**
 * Frontend API client for the server-side wallet engine.
 * Same method names as the old walletEngine so call sites are near-mechanical replacements.
 */

import type { MintConfig, DemoMode, WalletBalance, MigrationEvent, MintScore } from '../state/types';

// ── Result types (match server responses) ───────────────────────────
export interface Success<T> { ok: true; data: T }
export interface Failure     { ok: false; error: string }
export type Result<T> = Success<T> | Failure;

async function post<T>(path: string, body: unknown): Promise<Result<T>> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: Result<T> = await res.json();
  return json;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const json: T = await res.json();
  return json;
}

// ── Public API ──────────────────────────────────────────────────────

export const walletApi = {
  async getMode(): Promise<DemoMode> {
    const { mode } = await get<{ mode: DemoMode }>('/api/wallet/mode');
    return mode;
  },

  async setMode(mode: DemoMode, mintConfigs?: MintConfig[]): Promise<Result<void>> {
    return post('/api/wallet/set-mode', { mode, mintConfigs });
  },

  async getAllBalances(): Promise<{ balances: WalletBalance[]; total: number }> {
    return get('/api/wallet/balances');
  },

  async smartReceive(
    amount: number,
    scores: MintScore[],
  ): Promise<Result<{ quote: string; request: string; mintUrl: string }>> {
    return post('/api/wallet/receive', { amount, scores });
  },

  async pollMintQuote(
    mintUrl: string,
    quoteId: string,
  ): Promise<Result<{ credited: number }>> {
    return post('/api/wallet/poll', { mintUrl, quoteId });
  },

  async smartSend(
    invoice: string,
    scores: MintScore[],
  ): Promise<Result<{ paid: boolean; preimage: string | null; usedMints: string[] }>> {
    return post('/api/wallet/send', { invoice, scores });
  },

  async migrate(
    from: string,
    to: string,
    amount: number,
    reason?: string,
  ): Promise<Result<MigrationEvent>> {
    return post('/api/wallet/migrate', { from, to, amount, reason });
  },
};
