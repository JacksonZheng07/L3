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
 * Conservative approach: only move funds when there's a real safety reason.
 *   - Evacuate critical mints (score < 50) — these are genuinely unsafe
 *   - Reduce exposure to warning mints (score 50–74) that hold too much
 *   - NEVER move between safe mints — if it's safe, leave it alone.
 *     Every migration costs Lightning fees, so don't churn for marginal gains.
 */
// Minimum amount worth migrating — below this, fees eat too much
const MIN_MIGRATION_AMOUNT = 50; // sats

export function computeMigrationPlans(
  scores: MintScore[],
  balances: WalletBalance[],
  totalBalance: number,
): MigrationPlan[] {
  if (totalBalance <= 0 || scores.length === 0) return [];

  const plans: MigrationPlan[] = [];
  const balanceMap = new Map(balances.map((b) => [b.mintUrl, b.balance]));

  // Eligible targets: must be safe (score >= threshold + hysteresis) and online
  const safeTargets = scores
    .filter(
      (s) =>
        s.compositeScore >= MIGRATION_THRESHOLD + MIGRATION_HYSTERESIS &&
        s.isOnline &&
        s.grade === 'safe',
    )
    .sort((a, b) => b.compositeScore - a.compositeScore);

  if (safeTargets.length === 0) return []; // nowhere safe to move

  // ── Phase 1: Evacuate critical mints (score < 50) ─────────────────
  // These are genuinely dangerous — get everything out
  const criticalMints = scores.filter(
    (s) => s.compositeScore < MIGRATION_THRESHOLD,
  );

  for (const mint of criticalMints) {
    const currentBalance = balanceMap.get(mint.url) ?? 0;
    if (currentBalance < MIN_MIGRATION_AMOUNT) continue;

    const target = safeTargets.find((t) => t.url !== mint.url);
    if (!target) continue;

    plans.push({
      fromMint: mint.url,
      fromName: mint.name,
      toMint: target.url,
      toName: target.name,
      amount: currentBalance,
      reason: `CRITICAL: trust score ${mint.compositeScore.toFixed(0)} < ${MIGRATION_THRESHOLD}. Evacuating all funds.`,
    });
  }

  // ── Phase 2: Reduce overexposure to warning mints ─────────────────
  // Warning mints (score 50–74) aren't immediately dangerous, but we
  // shouldn't hold more than 25% of the portfolio there. Only move the
  // excess — don't drain them entirely.
  const WARNING_MAX_PCT = 25;
  const warningMints = scores.filter(
    (s) =>
      s.grade === 'warning' &&
      s.compositeScore >= MIGRATION_THRESHOLD,
  );

  for (const mint of warningMints) {
    const currentBalance = balanceMap.get(mint.url) ?? 0;
    const currentPct = (currentBalance / totalBalance) * 100;

    if (currentPct > WARNING_MAX_PCT && currentBalance > 0) {
      const excessPct = currentPct - WARNING_MAX_PCT;
      const excessAmount = Math.floor((excessPct / 100) * totalBalance);
      if (excessAmount < MIN_MIGRATION_AMOUNT) continue;

      const target = safeTargets.find((t) => t.url !== mint.url);
      if (!target) continue;

      plans.push({
        fromMint: mint.url,
        fromName: mint.name,
        toMint: target.url,
        toName: target.name,
        amount: excessAmount,
        reason: `WARNING: ${mint.name} score ${mint.compositeScore.toFixed(0)}, holding ${currentPct.toFixed(0)}% (max ${WARNING_MAX_PCT}% for warning mints). Moving excess.`,
      });
    }
  }

  // No Phase 3: safe mints are left alone. No rebalancing between safe mints.

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
