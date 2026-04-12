import type { MintConfig, DemoMode } from '../state/types';

export const ALLIUM_API_KEY = import.meta.env.VITE_ALLIUM_API_KEY || '';
export const ALLIUM_BASE_URL = 'https://api.allium.so/api/v1/developer';

export const TESTNET_MINT_URL = 'https://testnut.cashu.space';

/** Return the subset of mints appropriate for the given demo mode. */
export function getMintsForMode(allMints: MintConfig[], mode: DemoMode): MintConfig[] {
  switch (mode) {
    case 'mock':
      return allMints; // mock shows all mints in UI; tx ops are stubbed at engine level
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
  // All mints have operator addresses for Allium on-chain intelligence.
  // Note: For demo purposes, addresses are associated Bitcoin wallets with
  // rich on-chain history to demonstrate Allium data flow through the scoring pipeline.
  { url: 'https://mint.minibits.cash/Bitcoin',       name: 'Minibits',           operatorAddresses: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'] },
  { url: 'https://mint.coinos.io',                   name: 'Coinos',             operatorAddresses: ['3FHNBLobJnbCTFTVakh5TXmEneyf5PT61B'] },
  { url: 'https://testnut.cashu.space',              name: 'Testnut',            operatorAddresses: ['35hK24tcLEWcgNA4JxpvbkNkoAcDGqQPsP'] },
  { url: 'https://mint.macadamia.cash',              name: 'Macadamia',          operatorAddresses: ['385cR5DM96n1HvBDMzLHPYcw89fZAXULJP'] },
  { url: 'https://mint.0xchat.com',                  name: '0xChat',             operatorAddresses: ['12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S'] },
  { url: 'https://mint.lnvoltz.com',                 name: 'LN Voltz',           operatorAddresses: ['1Kr6QSydW9bFQG1mXiPNNu6WpJGmUa9i1g'] },
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
