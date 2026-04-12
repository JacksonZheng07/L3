import type { MintConfig, DemoMode } from '../state/types';

export const ALLIUM_API_KEY = import.meta.env.VITE_ALLIUM_API_KEY || '';
export const ALLIUM_BASE_URL = 'https://api.allium.so/api/v1/developer';

export const TESTNET_MINT_URL = 'https://testnut.cashu.space';

/** Return the subset of mints appropriate for the given demo mode. */
export function getMintsForMode(allMints: MintConfig[], mode: DemoMode): MintConfig[] {
  switch (mode) {
    case 'testnet':
      return allMints.filter((m) => m.url === TESTNET_MINT_URL);
    case 'mainnet':
      return allMints.filter((m) => m.url !== TESTNET_MINT_URL);
  }
}

// Log API key status on load (redacted)
if (ALLIUM_API_KEY) {
  console.log(`[L3] Allium API key loaded (${ALLIUM_API_KEY.slice(0, 8)}...)`);
} else {
  console.warn('[L3] No Allium API key set. Set VITE_ALLIUM_API_KEY in .env');
}

// ── Mint Registry ─────────────────────────────────────────────────
// operatorAddresses: Bitcoin addresses associated with the mint operator.
// When populated, Allium API is queried for on-chain intelligence.
// Empty = anonymous operator (Allium signals score 0).

export const MINTS: MintConfig[] = [
  { url: 'https://mint.minibits.cash/Bitcoin',       name: 'Minibits',           operatorAddresses: [] },
  { url: 'https://mint.coinos.io',                   name: 'Coinos',             operatorAddresses: [] },
  { url: 'https://testnut.cashu.space',              name: 'Testnut',            operatorAddresses: [] },
  { url: 'https://mint.macadamia.cash',              name: 'Macadamia',          operatorAddresses: [] },
  { url: 'https://mint.0xchat.com',                  name: '0xChat',             operatorAddresses: [] },
  { url: 'https://mint.lnvoltz.com',                 name: 'LN Voltz',           operatorAddresses: [] },
];

export const WEIGHTS: Record<string, number> = {
  operator_identity:    0.20,
  reserve_behavior:     0.20,
  transaction_patterns: 0.10,
  counterparty_network: 0.10,
  availability:         0.10,
  latency:              0.05,
  keyset_stability:     0.10,
  tx_success_rate:      0.10,
  protocol_version:     0.05,
};

export const THRESHOLD_SAFE = 75;
export const THRESHOLD_WARNING = 50;
export const THRESHOLD_CRITICAL = 50;
export const LATENCY_EXCELLENT = 500;
export const LATENCY_ACCEPTABLE = 2000;
export const KNOWN_VERSION_PREFIX = '0.15';
export const MAX_ALLOCATION = 0.40;
export const MIGRATION_THRESHOLD = 50;    // score below this → evacuate
export const MIGRATION_HYSTERESIS = 10;   // must score >= threshold + hysteresis to receive migrated funds
export const REBALANCE_DRIFT_PCT = 10;    // only rebalance if allocation drifts >10% from target
export const SCORING_INTERVAL_MS = 60_000; // 60s to stay within Allium rate limits (6 mints × 3 endpoints = 18 calls/cycle)
