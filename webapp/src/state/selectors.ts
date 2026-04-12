/**
 * L3 State Selectors — pure functions that derive values from app state.
 * No React, no dispatch, no mutations.
 */

import type { MintScore, WalletBalance } from './types';
import { portfolioLossDistribution, gaussianVaR, gaussianCVaR } from '../lib/stats';

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
  const safeMints     = scores.filter((s) => s.grade === 'safe');
  const warningMints  = scores.filter((s) => s.grade === 'warning');
  const criticalMints = scores.filter((s) => s.grade === 'critical');

  const groups: FederationGroup[] = [];

  if (safeMints.length > 0) {
    groups.push({
      id: 'safe-cluster', name: 'Safe Mint Cluster',
      description: 'Mints scoring ≥ 75 with high pSafe. In Fedimint, form a high-trust federation.',
      mints: safeMints,
      avgScore: safeMints.reduce((s, m) => s + m.compositeScore, 0) / safeMints.length,
      status: 'healthy',
      potentialThreshold: Math.ceil(safeMints.length * 0.6),
    });
  }

  if (warningMints.length > 0) {
    groups.push({
      id: 'warning-cluster', name: 'Warning Mint Cluster',
      description: 'Mints in warning band. Require monitoring; higher federation threshold needed.',
      mints: warningMints,
      avgScore: warningMints.reduce((s, m) => s + m.compositeScore, 0) / warningMints.length,
      status: 'degraded',
      potentialThreshold: Math.ceil(warningMints.length * 0.75),
    });
  }

  if (criticalMints.length > 0) {
    groups.push({
      id: 'critical-cluster', name: 'Critical Mints (Excluded)',
      description: 'Zero allocation. Would be excluded from any federation.',
      mints: criticalMints,
      avgScore: criticalMints.reduce((s, m) => s + m.compositeScore, 0) / criticalMints.length,
      status: 'offline',
      potentialThreshold: 0,
    });
  }

  return groups;
}

// ── Portfolio analytics ─────────────────────────────────────────────────

export interface PortfolioRisk {
  /** Expected loss (mean of the loss distribution), in sats */
  meanLoss: number;
  /** Standard deviation of the loss distribution, in sats */
  sigmaLoss: number;
  /** 95% VaR — loss level exceeded with 5% probability */
  var95: number;
  /** 99% VaR */
  var99: number;
  /** 95% CVaR / Expected Shortfall — average loss *given* exceeding VaR_95 */
  cvar95: number;
}

/**
 * Compute the portfolio loss distribution and VaR/CVaR using a Gaussian model.
 *
 * Each mint contributes:
 *   E[loss_i]   = exposure_i × (1 − μ_i / 100)
 *   Var[loss_i] = (exposure_i / 100)² × σ_i²
 *
 * Portfolio loss = sum of per-mint losses (assumes cross-mint independence).
 */
export function selectPortfolioRisk(scores: MintScore[], totalBalance: number): PortfolioRisk {
  const mints = scores.map((s) => ({
    allocationPct: s.allocationPct,
    scoreMu:    s.compositeScore,
    scoreSigma: Math.max(s.scoreSigma ?? 5, 2),
  }));

  const { meanLoss, sigmaLoss } = portfolioLossDistribution(mints, totalBalance);
  return {
    meanLoss,
    sigmaLoss,
    var95:  gaussianVaR(meanLoss, sigmaLoss, 0.95),
    var99:  gaussianVaR(meanLoss, sigmaLoss, 0.99),
    cvar95: gaussianCVaR(meanLoss, sigmaLoss, 0.95),
  };
}

/**
 * VaR if all funds were concentrated in the single highest-scoring mint.
 * Used to quantify the diversification benefit.
 */
export function selectSingleMintRisk(scores: MintScore[], totalBalance: number): PortfolioRisk {
  if (scores.length === 0) {
    return { meanLoss: totalBalance, sigmaLoss: 0, var95: totalBalance, var99: totalBalance, cvar95: totalBalance };
  }
  const best = scores.reduce((b, m) => (m.compositeScore > b.compositeScore ? m : b));
  const mints = [{ allocationPct: 100, scoreMu: best.compositeScore, scoreSigma: Math.max(best.scoreSigma ?? 5, 2) }];
  const { meanLoss, sigmaLoss } = portfolioLossDistribution(mints, totalBalance);
  return {
    meanLoss,
    sigmaLoss,
    var95:  gaussianVaR(meanLoss, sigmaLoss, 0.95),
    var99:  gaussianVaR(meanLoss, sigmaLoss, 0.99),
    cvar95: gaussianCVaR(meanLoss, sigmaLoss, 0.95),
  };
}

/** Reduction in 95% VaR achieved by diversification vs single-mint allocation */
export function selectDiversificationBenefit(scores: MintScore[], totalBalance: number): number {
  if (totalBalance === 0) return 0;
  const portfolio  = selectPortfolioRisk(scores, totalBalance);
  const singleMint = selectSingleMintRisk(scores, totalBalance);
  if (singleMint.var95 <= 0) return 0;
  return ((singleMint.var95 - portfolio.var95) / singleMint.var95) * 100;
}

// ── Convenience wrappers (backward compat with DashboardScreen) ─────────

/** 95% VaR in sats (Gaussian) */
export function selectPortfolioVaR(scores: MintScore[], totalBalance: number): number {
  return selectPortfolioRisk(scores, totalBalance).var95;
}

/** 95% VaR if all funds in single best mint */
export function selectSingleMintVaR(scores: MintScore[], totalBalance: number): number {
  return selectSingleMintRisk(scores, totalBalance).var95;
}

/** Group scores by grade */
export function selectScoresByGrade(scores: MintScore[]) {
  return {
    safe:     scores.filter((s) => s.grade === 'safe'),
    warning:  scores.filter((s) => s.grade === 'warning'),
    critical: scores.filter((s) => s.grade === 'critical'),
  };
}

/** Percentage of portfolio balance held in safe-graded mints */
export function selectSafePct(scores: MintScore[]): number {
  return scores.filter((s) => s.grade === 'safe').reduce((sum, s) => sum + s.allocationPct, 0);
}
