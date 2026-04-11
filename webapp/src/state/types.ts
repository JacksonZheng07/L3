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
}
