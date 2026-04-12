export interface MintConfig {
  url: string;
  name: string;
  operatorAddresses: string[];
}

export interface SignalResult {
  name: string;
  value: number;       // 0.0 to 1.0 (point estimate μ)
  weight: number;
  contribution: number; // value * weight
  source: 'allium' | 'direct';
  explanation: string;
  /** Uncertainty — std dev of the true signal value (0.0 = certain, 0.5 = maximum uncertainty) */
  sigma: number;
  rawData?: Record<string, unknown>;
}

export interface MintScore {
  url: string;
  name: string;
  isAnonymous: boolean;
  signals: SignalResult[];

  // ── Point estimate ──────────────────────────────────────────────
  compositeScore: number;    // μ of the score distribution, 0-100
  scoreSigma: number;        // σ of the composite score, 0-100 (higher = less certain)

  // ── Probabilistic grade ─────────────────────────────────────────
  /** P(true score ≥ 75) — probability this mint is genuinely "safe" */
  pSafe: number;
  /** P(50 ≤ true score < 75) */
  pWarning: number;
  /** P(true score < 50) — probability this mint is genuinely "critical" */
  pCritical: number;
  grade: 'safe' | 'warning' | 'critical'; // argmax of the three probabilities

  // ── Momentum ────────────────────────────────────────────────────
  /** Raw score Δ since the previous scoring cycle (+ = improving) */
  velocity: number;
  /** Momentum-adjusted score: compositeScore + λ × velocity */
  adjustedScore: number;

  // ── Allocation ──────────────────────────────────────────────────
  allocationPct: number;      // Sharpe-weighted allocation (capped at MAX_ALLOCATION)
  kellyAllocation: number;    // Kelly-criterion allocation (for comparison)

  scoredAt: string;
  isOnline: boolean;
  latencyMs: number;
  version: string;
  keysetCount: number;
}

export interface ProbeResult {
  info: {
    success: boolean;
    latencyMs: number;
    data: Record<string, unknown> | null;
  };
  keysets: {
    success: boolean;
    keysetIds: string[];
  };
}

export interface MigrationEvent {
  id: string;
  fromMint: string;
  toMint: string;
  amount: number;
  reason: string;
  timestamp: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface WalletBalance {
  mintUrl: string;
  mintName: string;
  balance: number; // sats
}

// ── Automation Mode ────────────────────────────────────────────
export type AutomationMode = 'auto' | 'alert' | 'manual';

// ── Trust Alerts ───────────────────────────────────────────────
export interface TrustAlert {
  id: string;
  timestamp: string;
  mintUrl: string;
  mintName: string;
  type: 'score_drop' | 'critical' | 'migration_suggested' | 'migration_executed' | 'recovery';
  message: string;
  score: number;
  previousScore?: number;
  dismissed: boolean;
  actionTaken?: 'migrated' | 'ignored' | 'pending';
}

// ── Simulation ─────────────────────────────────────────────────
export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  mintOverrides: Record<string, Partial<MintScore>>;
}

export type AppView = 'dashboard' | 'mints' | 'alerts' | 'simulation' | 'migrations' | 'wallet';

export interface WalletConnection {
  connected: boolean;
  hasSeed: boolean;
  mintStatuses: Record<string, 'idle' | 'connecting' | 'connected' | 'failed'>;
}

// Demo environment mode
export type DemoMode = 'testnet' | 'mainnet';

// Fedimint entity wallets
export interface EntityWallet {
  id: string;
  name: string;
  role: 'user' | 'mint_operator' | 'guardian' | 'federation';
  balanceSats: number;
  address: string; // Lightning or on-chain address
  mintUrl?: string;
  federationId?: string;
}

// Fedimint federation
export interface Federation {
  id: string;
  name: string;
  guardians: EntityWallet[];
  threshold: number; // m-of-n
  totalGuardians: number;
  mintUrl: string;
  trustScore: number;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface AppState {
  discoveredMints: MintConfig[];
  scores: MintScore[];
  probeResults: Map<string, ProbeResult>;
  migrations: MigrationEvent[];
  balances: WalletBalance[];
  totalBalance: number;
  isScoring: boolean;
  lastScoredAt: string | null;
  currentView: AppView;
  selectedMint: string | null;
  automationMode: AutomationMode;
  alerts: TrustAlert[];
  simulationActive: boolean;
  simulationScores: MintScore[] | null;
  demoMode: DemoMode;
  entityWallets: EntityWallet[];
  federations: Federation[];
}
