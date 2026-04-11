import { type Proof } from '@cashu/cashu-ts';
export type { Proof } from '@cashu/cashu-ts';

// ─── Cashu Types ────────────────────────────────────────
export interface MintConnection {
  url: string;
  name: string;
}

// ─── Trust Types ────────────────────────────────────────
export interface TrustSignals {
  availability: number;
  latency: number;
  keysetStable: number;
  txSuccessRate: number;
  versionCurrent: number;
  operatorInfo: number;
}

export interface TrustScore {
  signals: TrustSignals;
  score: number;
  grade: 'safe' | 'warning' | 'critical';
  lastChecked: number;
}

// ─── Migration Types ────────────────────────────────────
export interface MigrationEvent {
  id: string;
  timestamp: number;
  fromMint: string;
  toMint: string;
  amount: number;
  reason: string;
  triggerScore: number;
  status: 'pending' | 'melting' | 'minting' | 'success' | 'failed';
  error?: string;
}

// ─── Transaction Types ──────────────────────────────────
export interface Transaction {
  id: string;
  timestamp: number;
  type: 'receive' | 'send' | 'migration_out' | 'migration_in';
  mint: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  invoice?: string;
  error?: string;
}

// ─── App State ──────────────────────────────────────────
export interface MintState {
  url: string;
  name: string;
  proofs: Proof[];
  balance: number;
  trustScore: TrustScore;
  cachedKeysets: string[];
  txTotal: number;
  txSuccess: number;
  healthCheckFailures: number;
}

export interface AppState {
  mints: Record<string, MintState>;
  transactions: Transaction[];
  migrations: MigrationEvent[];
  isMigrating: boolean;
  graduationShown: boolean;
}

// ─── Events ─────────────────────────────────────────────
export type AppEvent =
  | { type: 'TRUST_UPDATED'; mintUrl: string; score: TrustScore }
  | { type: 'MIGRATION_STARTED'; event: MigrationEvent }
  | { type: 'MIGRATION_COMPLETED'; event: MigrationEvent }
  | { type: 'MIGRATION_FAILED'; event: MigrationEvent }
  | { type: 'PROOFS_UPDATED'; mintUrl: string; proofs: Proof[] }
  | { type: 'TX_RECORDED'; tx: Transaction }
  | { type: 'BALANCE_THRESHOLD_CROSSED'; totalBalance: number };
