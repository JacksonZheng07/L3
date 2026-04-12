import type { MintConfig } from '../state/types';

export const ALLIUM_API_KEY = import.meta.env.VITE_ALLIUM_API_KEY || '';
export const ALLIUM_BASE_URL = 'https://api.allium.so/api/v1/developer';

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
  // Mints with known operator addresses (Allium will query these)
  { url: 'https://mint.minibits.cash/Bitcoin',       name: 'Minibits',           operatorAddresses: ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'] },
  { url: 'https://mint.coinos.io',                   name: 'Coinos',             operatorAddresses: ['bc1q7cyrfmck2ffu2ud3rn5l5a8yv6f0chkp0zpemf'] },
  { url: 'https://mint.lnbits.com/cashu/api/v1/AptDNABNBXv8gpuywhx6NV', name: 'LNbits Cashu', operatorAddresses: [] },

  // Anonymous mints (no on-chain identity — capped at ~40 score max)
  { url: 'https://testnut.cashu.space',              name: 'Testnut',            operatorAddresses: [] },
  { url: 'https://8333.space:3338',                  name: '8333.space',         operatorAddresses: [] },
  { url: 'https://mint.macadamia.cash',              name: 'Macadamia',          operatorAddresses: [] },
  { url: 'https://mint.enuts.cash',                  name: 'eNuts',              operatorAddresses: [] },
  { url: 'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoC', name: 'Legend LNbits', operatorAddresses: [] },
  { url: 'https://mint.nutstash.app',                name: 'Nutstash',           operatorAddresses: [] },
  { url: 'https://mint.0xchat.com',                  name: '0xChat',             operatorAddresses: [] },
  { url: 'https://mint.lnvoltz.com',                 name: 'LN Voltz',           operatorAddresses: [] },
  { url: 'https://nuts.jooray.com',                  name: 'Jooray Nuts',        operatorAddresses: [] },
  { url: 'https://mint.bitcointxoko.com',            name: 'Bitcoin Txoko',      operatorAddresses: [] },
  { url: 'https://mint.siamstr.com',                 name: 'Siamstr',            operatorAddresses: [] },
  { url: 'https://mint.nimo.cash',                   name: 'Nimo Cash',          operatorAddresses: [] },
  { url: 'https://cashme.lnmarkets.com',             name: 'LN Markets',         operatorAddresses: [] },
  { url: 'https://mint.sovereign.app',               name: 'Sovereign',          operatorAddresses: [] },
  { url: 'https://mint.wontfix.de',                  name: 'Wontfix',            operatorAddresses: [] },
  { url: 'https://mint.lnwallet.app',                name: 'LN Wallet',          operatorAddresses: [] },
  { url: 'https://mint.0sats.com',                   name: '0sats',              operatorAddresses: [] },
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
export const SCORING_INTERVAL_MS = 30_000;
