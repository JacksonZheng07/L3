export interface MintConfig {
  url: string;
  name: string;
  operatorAddresses: string[];
}

export interface SignalResult {
  name: string;
  value: number;       // 0.0 to 1.0
  weight: number;
  contribution: number; // value * weight
  source: 'allium' | 'direct';
  explanation: string;
  rawData?: Record<string, unknown>;
}

export interface MintScore {
  url: string;
  name: string;
  isAnonymous: boolean;
  signals: SignalResult[];
  compositeScore: number; // 0-100
  grade: 'safe' | 'warning' | 'critical';
  allocationPct: number;
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

export type AppView = 'dashboard' | 'mints' | 'send' | 'receive';

export interface AppState {
  scores: MintScore[];
  probeResults: Map<string, ProbeResult>;
  migrations: MigrationEvent[];
  balances: WalletBalance[];
  totalBalance: number;
  isScoring: boolean;
  lastScoredAt: string | null;
  currentView: AppView;
  selectedMint: string | null;
  // New fields
  automationMode: AutomationMode;
  alerts: TrustAlert[];
  simulationActive: boolean;
  simulationScores: MintScore[] | null; // overrides scores when sim is active
}
