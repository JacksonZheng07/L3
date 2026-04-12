/**
 * L3 State Selectors — pure functions that derive values from app state.
 * No React, no dispatch, no mutations.
 */

import type { MintScore, WalletBalance } from './types';

// ── Entity Wallet derivation ────────────────────────────────────────────

export interface DerivedEntityWallet {
  id: string;
  name: string;
  role: 'user' | 'mint_operator';
  balanceSats: number;
  address: string;
  extra?: {
    online: boolean;
    trustScore: number;
    grade: 'safe' | 'warning' | 'critical';
    latencyMs: number;
  };
}

/** Derive the displayable entity wallet list from scores + balances */
export function selectEntityWallets(
  scores: MintScore[],
  balances: WalletBalance[],
  totalBalance: number,
): DerivedEntityWallet[] {
  const userWallet: DerivedEntityWallet = {
    id: 'user-wallet',
    name: 'L3 User Wallet',
    role: 'user',
    balanceSats: totalBalance,
    address: 'Browser (ecash proofs in localStorage)',
  };

  const mintWallets: DerivedEntityWallet[] = scores.map((score) => {
    const walletBalance = balances.find((b) => b.mintUrl === score.url);
    return {
      id: `mint-${score.url}`,
      name: score.name,
      role: 'mint_operator',
      balanceSats: walletBalance?.balance ?? 0,
      address: score.url,
      extra: {
        online: score.isOnline,
        trustScore: score.compositeScore,
        grade: score.grade,
        latencyMs: score.latencyMs,
      },
    };
  });

  return [userWallet, ...mintWallets];
}

// ── Federation Group derivation ─────────────────────────────────────────

export interface FederationGroup {
  id: string;
  name: string;
  description: string;
  mints: MintScore[];
  avgScore: number;
  status: 'healthy' | 'degraded' | 'offline';
  potentialThreshold: number;
}

/** Derive federation-like groupings from scored mints by grade tier */
export function selectFederationGroups(scores: MintScore[]): FederationGroup[] {
  const safeMints = scores.filter((s) => s.grade === 'safe');
  const warningMints = scores.filter((s) => s.grade === 'warning');
  const criticalMints = scores.filter((s) => s.grade === 'critical');

  const groups: FederationGroup[] = [];

  if (safeMints.length > 0) {
    groups.push({
      id: 'safe-cluster',
      name: 'Safe Mint Cluster',
      description:
        'Mints scoring >= 75. In a Fedimint model, these would form a high-trust federation.',
      mints: safeMints,
      avgScore: safeMints.reduce((s, m) => s + m.compositeScore, 0) / safeMints.length,
      status: 'healthy',
      potentialThreshold: Math.ceil(safeMints.length * 0.6),
    });
  }

  if (warningMints.length > 0) {
    groups.push({
      id: 'warning-cluster',
      name: 'Warning Mint Cluster',
      description:
        'Mints scoring 50–74. Require monitoring. Federation threshold would need to be higher.',
      mints: warningMints,
      avgScore: warningMints.reduce((s, m) => s + m.compositeScore, 0) / warningMints.length,
      status: 'degraded',
      potentialThreshold: Math.ceil(warningMints.length * 0.75),
    });
  }

  if (criticalMints.length > 0) {
    groups.push({
      id: 'critical-cluster',
      name: 'Critical Mints (Excluded)',
      description:
        'Mints scoring < 50. Zero allocation. Would be excluded from any federation.',
      mints: criticalMints,
      avgScore: criticalMints.reduce((s, m) => s + m.compositeScore, 0) / criticalMints.length,
      status: 'offline',
      potentialThreshold: 0,
    });
  }

  return groups;
}

// ── Portfolio analytics ─────────────────────────────────────────────────

/** Compute the portfolio Value-at-Risk in sats */
export function selectPortfolioVaR(scores: MintScore[], totalBalance: number): number {
  return scores.reduce((sum, mint) => {
    const exposure = (mint.allocationPct / 100) * totalBalance;
    return sum + exposure * (1 - mint.compositeScore / 100);
  }, 0);
}

/** Compute the VaR if all funds were in the single best mint */
export function selectSingleMintVaR(scores: MintScore[], totalBalance: number): number {
  if (scores.length === 0) return totalBalance;
  const best = scores.reduce((b, m) => (m.compositeScore > b.compositeScore ? m : b));
  return totalBalance * (1 - best.compositeScore / 100);
}

/** Group scores by grade — safe/warning/critical */
export function selectScoresByGrade(scores: MintScore[]) {
  return {
    safe: scores.filter((s) => s.grade === 'safe'),
    warning: scores.filter((s) => s.grade === 'warning'),
    critical: scores.filter((s) => s.grade === 'critical'),
  };
}

/** Percentage of portfolio balance held in safe-graded mints */
export function selectSafePct(scores: MintScore[]): number {
  return scores.filter((s) => s.grade === 'safe').reduce((sum, s) => sum + s.allocationPct, 0);
}
