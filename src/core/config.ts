export const config = {
  // ─── Mint connections ────────────────────────────────
  mints: {
    a: import.meta.env.VITE_MINT_A_URL,
    b: import.meta.env.VITE_MINT_B_URL,
  },

  // ─── LNbits ──────────────────────────────────────────
  lnbits: {
    url: import.meta.env.VITE_LNBITS_URL,
    apiKey: import.meta.env.VITE_LNBITS_API_KEY,
  },

  // ─── Trust scoring ──────────────────────────────────
  trust: {
    evaluationIntervalMs: 30_000,

    weights: {
      availability: 0.25,
      latency: 0.10,
      keysetStable: 0.25,
      txSuccessRate: 0.20,
      versionCurrent: 0.10,
      operatorInfo: 0.10,
    },

    thresholds: {
      safe: 75,
      warning: 50,
      critical: 50,
    },

    knownVersionPrefix: '0.15',

    latency: {
      excellent: 500,
      acceptable: 2000,
    },
  },

  // ─── Migration ──────────────────────────────────────
  migration: {
    enabled: true,
    triggerThreshold: 50,
    minMigrationAmount: 100,
    cooldownMs: 60_000,
    maxRetries: 2,
    retryBackoffMs: 5_000,
  },

  // ─── Network ────────────────────────────────────────
  network: {
    timeoutMs: 10_000,
    retryCount: 2,
    retryBackoffMs: 2_000,
  },

  // ─── UI ─────────────────────────────────────────────
  ui: {
    pollIntervalMs: 3_000,
    graduationThresholdSats: 50_000,
    graduationThresholdDemo: 1_000,
    maxTxHistoryDisplay: 20,
    maxMigrationLogDisplay: 10,
  },
} as const;

// ─── Validation (runs on app load) ────────────────────
export function validateConfig(): void {
  const weights = Object.values(config.trust.weights);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(
      `Trust weights must sum to 1.0, got ${weightSum}. ` +
      `Current weights: ${JSON.stringify(config.trust.weights)}`
    );
  }

  if (config.trust.thresholds.safe <= config.trust.thresholds.warning) {
    throw new Error(
      `Safe threshold (${config.trust.thresholds.safe}) must be > ` +
      `warning threshold (${config.trust.thresholds.warning})`
    );
  }

  if (!config.mints.a || !config.mints.b) {
    throw new Error('Both VITE_MINT_A_URL and VITE_MINT_B_URL must be set in .env');
  }

  if (!config.lnbits.url || !config.lnbits.apiKey) {
    throw new Error('VITE_LNBITS_URL and VITE_LNBITS_API_KEY must be set in .env');
  }
}
