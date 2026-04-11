/**
 * L³ Network Layer
 * Fetch wrapper with timeout and retry for Cashu mint endpoints and Allium API.
 */

import { ALLIUM_API_KEY, ALLIUM_BASE_URL } from './config';

// ── Types ────────────────────────────────────────────────────────────

export interface MintInfoResult {
  success: boolean;
  latencyMs: number;
  data: Record<string, unknown> | null;
}

export interface MintKeysetResult {
  success: boolean;
  keysetIds: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  );
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  timeoutMs = 10_000,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        // Exponential back-off: 500ms, 1000ms
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// ── Cashu Mint Probing ───────────────────────────────────────────────

export async function probeMintInfo(mintUrl: string): Promise<MintInfoResult> {
  const start = performance.now();
  try {
    const response = await fetchWithRetry(`${mintUrl}/v1/info`, {}, 1, 10_000);
    const latencyMs = Math.round(performance.now() - start);

    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      return { success: true, latencyMs, data };
    }
    return { success: false, latencyMs, data: null };
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return { success: false, latencyMs, data: null };
  }
}

export async function probeMintKeysets(
  mintUrl: string,
): Promise<MintKeysetResult> {
  try {
    const response = await fetchWithRetry(
      `${mintUrl}/v1/keysets`,
      {},
      1,
      10_000,
    );
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      const keysets = Array.isArray(data.keysets) ? data.keysets : [];
      const keysetIds = keysets.map(
        (k: Record<string, unknown>) => String(k.id ?? ''),
      );
      return { success: true, keysetIds };
    }
    return { success: false, keysetIds: [] };
  } catch {
    return { success: false, keysetIds: [] };
  }
}

// ── Allium API ───────────────────────────────────────────────────────

export async function alliumRequest(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (!ALLIUM_API_KEY) return null;

  try {
    const response = await fetchWithRetry(
      `${ALLIUM_BASE_URL}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': ALLIUM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      2,
      15_000,
    );

    if (response.ok) {
      return (await response.json()) as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchWalletTransactions(
  address: string,
  chain = 'bitcoin',
): Promise<Record<string, unknown> | null> {
  return alliumRequest('/wallet/transactions', { address, chain });
}

export async function fetchWalletBalances(
  address: string,
  chain = 'bitcoin',
): Promise<Record<string, unknown> | null> {
  return alliumRequest('/wallet/latest-token-balances', {
    addresses: [{ address, chain }],
  });
}

export async function fetchHistoricalBalances(
  address: string,
  chain = 'bitcoin',
): Promise<Record<string, unknown> | null> {
  return alliumRequest('/wallet/historical-token-balances', {
    addresses: [{ address, chain }],
  });
}
