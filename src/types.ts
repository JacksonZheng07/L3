import type { Proof, MintQuoteBolt11Response, MeltQuoteBolt11Response } from '@cashu/cashu-ts';

export interface MintConfig {
  url: string;
  alias: string;
}

export interface MintTrustScore {
  infoResponsive: boolean;
  hasOperatorInfo: boolean;
  currentVersion: boolean;
  keysetStable: boolean;
  txSuccessRate: number;
  uptimeClean: boolean;
  totalScore: number;
}

export interface MintState {
  url: string;
  alias: string;
  proofs: Proof[];
  balance: number;
  trustScore: MintTrustScore;
  initialKeysetIds: string[];
  txSuccess: number;
  txTotal: number;
  healthChecksFailed: number;
  info: MintInfo | null;
}

export interface MintInfo {
  name: string;
  version: string;
  description?: string;
  contact: Array<{ method: string; info: string }>;
}

export interface Transaction {
  id: string;
  type: 'receive' | 'send';
  amount: number;
  mintUrl: string;
  mintAlias: string;
  timestamp: number;
  status: 'pending' | 'complete' | 'failed';
}

export type Screen = 'home' | 'receive' | 'send' | 'settings' | 'about';

export type { Proof, MintQuoteBolt11Response, MeltQuoteBolt11Response };
