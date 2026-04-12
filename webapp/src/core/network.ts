/**
 * L³ Network Layer
 * Fetch wrapper with timeout and retry for Cashu mint endpoints and Allium API.
 *
 * Allium API docs: https://docs.allium.so/
 * - In production: calls go through /api/allium serverless proxy (keeps key server-side)
 * - In dev with VITE_ALLIUM_API_KEY: calls go directly to Allium API
 */

import { ALLIUM_API_KEY } from './config';

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
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// ── CORS proxy helper ────────────────────────────────────────────────
// Route mint requests through the server-side CORS proxy.
// https://example.com/v1/info → /api/cashu-proxy?target=example.com/v1/info
function proxyMintUrl(mintUrl: string, path: string): string {
  const host = mintUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `/api/cashu-proxy?target=${encodeURIComponent(host + path)}`;
}

// ── Cashu Mint Probing ───────────────────────────────────────────────

export async function probeMintInfo(mintUrl: string): Promise<MintInfoResult> {
  const start = performance.now();
  try {
    const response = await fetchWithRetry(proxyMintUrl(mintUrl, '/v1/info'), {}, 1, 10_000);
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
      proxyMintUrl(mintUrl, '/v1/keysets'),
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
//
// Two modes:
// 1. Production (deployed to Vercel): calls /api/allium?endpoint=... serverless proxy
// 2. Dev with API key: calls Allium directly
//
// Allium wallet endpoints expect POST with JSON array body: [{chain, address}]

const ALLIUM_DIRECT_BASE = 'https://api.allium.so/api/v1/developer';
const useProxy = !ALLIUM_API_KEY; // use proxy when no client-side key

if (useProxy && import.meta.env.DEV) {
  console.error('[Allium] No API key found — set VITE_ALLIUM_API_KEY in webapp/.env. Proxy mode will fail in dev.');
}

async function alliumPost(
  endpoint: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  let url: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (useProxy) {
    url = `/api/allium?endpoint=${encodeURIComponent(endpoint)}`;
  } else {
    url = `${ALLIUM_DIRECT_BASE}${endpoint}`;
    headers['X-API-KEY'] = ALLIUM_API_KEY;
  }

  // Retry with backoff on 429 rate limits
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchWithRetry(
        url,
        { method: 'POST', headers, body: JSON.stringify(body) },
        1,
        15_000,
      );

      if (response.ok) {
        return (await response.json()) as Record<string, unknown>;
      }

      if (response.status === 429) {
        const wait = 2000 * (attempt + 1);
        console.warn(`[Allium] 429 on ${endpoint}, backing off ${wait}ms…`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      const errorText = await response.text().catch(() => 'unknown');
      console.warn(`[Allium] ${response.status} ${endpoint}: ${errorText}`);
      return null;
    } catch (err) {
      console.warn(`[Allium] Network error on ${endpoint}:`, err);
      return null;
    }
  }

  console.warn(`[Allium] Gave up on ${endpoint} after 429 retries`);
  return null;
}

/**
 * Fetch wallet transactions for an address.
 * Allium expects: POST /wallet/transactions with body: [{chain, address}]
 */
export async function fetchWalletTransactions(
  address: string,
  chain = 'bitcoin',
): Promise<Record<string, unknown> | null> {
  return alliumPost('/wallet/transactions', [{ address, chain }]);
}

/**
 * Fetch current token balances for an address.
 * Allium expects: POST /wallet/balances with body: [{chain, address}]
 */
export async function fetchWalletBalances(
  address: string,
  chain = 'bitcoin',
): Promise<Record<string, unknown> | null> {
  return alliumPost('/wallet/balances', [{ address, chain }]);
}

/**
 * Fetch historical balances for an address.
 * Allium expects: POST /wallet/balances/history with body:
 *   { addresses: [{chain, address}], start_timestamp, end_timestamp }
 */
export async function fetchHistoricalBalances(
  address: string,
  chain = 'bitcoin',
): Promise<Record<string, unknown> | null> {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - 365 * 86_400_000).toISOString(); // 1 year ago
  return alliumPost('/wallet/balances/history', {
    addresses: [{ address, chain }],
    start_timestamp: start,
    end_timestamp: end,
  });
}
