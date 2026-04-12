/**
 * L³ Migration Decision Engine
 *
 * Decides when and where to move funds based on:
 * - Trust scores and allocation targets from trustEngine
 * - Current balances from walletEngine
 * - Hysteresis to prevent oscillation
 * - Actual wallet migration via Lightning (walletEngine.migrate)
 */

import type { MintScore, MigrationEvent, WalletBalance } from '../state/types';
import {
  MIGRATION_THRESHOLD,
  MIGRATION_HYSTERESIS,
  REBALANCE_DRIFT_PCT,
} from './config';
import { walletApi } from './walletApi';

export interface MigrationPlan {
  fromMint: string;
  fromName: string;
  toMint: string;
  toName: string;
  amount: number;
  reason: string;
}

/**
 * Compute migration plans given current scores, balances, and total portfolio value.
 * Does NOT execute them — returns a list of planned moves.
 *
 * Two phases:
 *   1. Evacuate: move funds OUT of critical mints (score < threshold)
 *   2. Rebalance: nudge toward target allocation if drift exceeds threshold
 */
export function computeMigrationPlans(
  scores: MintScore[],
  balances: WalletBalance[],
  totalBalance: number,
): MigrationPlan[] {
  if (totalBalance <= 0 || scores.length === 0) return [];

  const plans: MigrationPlan[] = [];
  const balanceMap = new Map(balances.map((b) => [b.mintUrl, b.balance]));

  // Eligible targets: score >= threshold + hysteresis and online
  const eligibleTargets = scores.filter(
    (s) =>
      s.compositeScore >= MIGRATION_THRESHOLD + MIGRATION_HYSTERESIS &&
      s.isOnline &&
      s.grade !== 'critical',
  );

  if (eligibleTargets.length === 0) return []; // nowhere safe to move

  // Sort targets by score descending (prefer highest-trust mints)
  const sortedTargets = [...eligibleTargets].sort(
    (a, b) => b.compositeScore - a.compositeScore,
  );

  // ── Phase 1: Evacuate critical mints ──────────────────────────────
  const criticalMints = scores.filter(
    (s) => s.compositeScore < MIGRATION_THRESHOLD,
  );

  for (const mint of criticalMints) {
    const currentBalance = balanceMap.get(mint.url) ?? 0;
    if (currentBalance <= 0) continue;

    // Find the best target that isn't this mint
    const target = sortedTargets.find((t) => t.url !== mint.url);
    if (!target) continue;

    plans.push({
      fromMint: mint.url,
      fromName: mint.name,
      toMint: target.url,
      toName: target.name,
      amount: currentBalance,
      reason: `Trust score ${mint.compositeScore.toFixed(0)} < ${MIGRATION_THRESHOLD} (critical). Evacuating all funds.`,
    });
  }

  // ── Phase 2: Rebalance toward target allocation ───────────────────
  // Only rebalance non-critical mints if drift is large enough
  const nonCritical = scores.filter(
    (s) => s.compositeScore >= MIGRATION_THRESHOLD,
  );

  for (const mint of nonCritical) {
    const currentBalance = balanceMap.get(mint.url) ?? 0;
    const currentPct = totalBalance > 0 ? (currentBalance / totalBalance) * 100 : 0;
    const targetPct = mint.allocationPct;
    const drift = currentPct - targetPct;

    // Only rebalance if overweight by more than the drift threshold
    if (drift > REBALANCE_DRIFT_PCT && currentBalance > 0) {
      const excessAmount = Math.floor((drift / 100) * totalBalance);
      if (excessAmount <= 0) continue;

      // Find the most underweight eligible target
      const underweightTarget = sortedTargets.find((t) => {
        if (t.url === mint.url) return false;
        const tBal = balanceMap.get(t.url) ?? 0;
        const tCurrentPct = totalBalance > 0 ? (tBal / totalBalance) * 100 : 0;
        return t.allocationPct - tCurrentPct > REBALANCE_DRIFT_PCT / 2;
      });

      if (!underweightTarget) continue;

      plans.push({
        fromMint: mint.url,
        fromName: mint.name,
        toMint: underweightTarget.url,
        toName: underweightTarget.name,
        amount: excessAmount,
        reason: `Rebalancing: ${mint.name} at ${currentPct.toFixed(1)}% vs target ${targetPct.toFixed(1)}% (drift ${drift.toFixed(1)}%)`,
      });
    }
  }

  return plans;
}

/**
 * Execute a migration plan using the wallet engine.
 * Returns the completed MigrationEvent or null on failure.
 */
export async function executeMigration(
  plan: MigrationPlan,
): Promise<MigrationEvent | null> {
  const result = await walletApi.migrate(
    plan.fromMint,
    plan.toMint,
    plan.amount,
    plan.reason,
  );

  if (result.ok) {
    return result.data;
  }

  console.warn(`[MigrationEngine] Migration failed: ${result.error}`);
  return {
    id: crypto.randomUUID(),
    fromMint: plan.fromName,
    toMint: plan.toName,
    amount: plan.amount,
    reason: plan.reason,
    timestamp: new Date().toISOString(),
    status: 'failed',
  };
}
