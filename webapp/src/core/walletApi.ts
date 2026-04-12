/**
 * Frontend API client for the server-side wallet engine.
 * Same method names as the old walletEngine so call sites are near-mechanical replacements.
 */

import type { MintConfig, DemoMode, WalletBalance, MigrationEvent, MintScore, TrustAlert } from '../state/types';

// ── Result types (match server responses) ───────────────────────────
export interface Success<T> { ok: true; data: T }
export interface Failure     { ok: false; error: string }
export type Result<T> = Success<T> | Failure;

async function post<T>(path: string, body: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, error: `Server error: ${res.status} ${res.statusText}` };
    }
    const json: Result<T> = await res.json();
    return json;
  } catch (err) {
    return { ok: false, error: `Network error: ${String(err)}` };
  }
}

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    const json: T = await res.json();
    return json;
  } catch {
    return fallback;
  }
}

// ── Public API ──────────────────────────────────────────────────────

export const walletApi = {
  async getMode(): Promise<DemoMode> {
    const { mode } = await get<{ mode: DemoMode }>('/api/wallet/mode', { mode: 'mutinynet' });
    return mode;
  },

  async setMode(mode: DemoMode, mintConfigs?: MintConfig[]): Promise<Result<void>> {
    return post('/api/wallet/set-mode', { mode, mintConfigs });
  },

  async getAllBalances(): Promise<{ balances: WalletBalance[]; total: number }> {
    return get('/api/wallet/balances', { balances: [], total: 0 });
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

  // ── Discord notifications ──────────────────────────────────────────

  async notifyDiscord(alerts: TrustAlert[]): Promise<Result<{ sent: number }>> {
    return post('/api/discord/notify', { alerts });
  },

  async getDiscordStatus(): Promise<{ configured: boolean; channelId: string | null }> {
    return get('/api/discord/status', { configured: false, channelId: null });
  },

  async testDiscord(): Promise<Result<void>> {
    return post('/api/discord/test', {});
  },
};
