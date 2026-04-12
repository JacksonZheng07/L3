/**
 * L3 Alert Engine — pure functions for generating TrustAlerts.
 * No React, no dispatch, no side effects.
 * Takes data in, returns alert arrays out.
 */

import type { MintScore, TrustAlert, AutomationMode, MigrationEvent } from '../state/types';
import type { MigrationPlan } from './migrationEngine';

/**
 * Compare new scores against the previous score map and generate alerts
 * for critical drops, significant drops (>=10 pts), and recoveries.
 */
export function generateScoreAlerts(
  scores: MintScore[],
  prevScores: Map<string, number>,
): TrustAlert[] {
  const alerts: TrustAlert[] = [];

  for (const score of scores) {
    const prevScore = prevScores.get(score.url);
    if (prevScore === undefined) continue;

    const drop = prevScore - score.compositeScore;

    if (score.grade === 'critical' && drop > 0) {
      alerts.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mintUrl: score.url,
        mintName: score.name,
        type: 'critical',
        message: `${score.name} dropped to CRITICAL (${score.compositeScore.toFixed(0)}/100). Funds at risk.`,
        score: score.compositeScore,
        previousScore: prevScore,
        dismissed: false,
        actionTaken: 'pending',
      });
    } else if (drop >= 10) {
      alerts.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mintUrl: score.url,
        mintName: score.name,
        type: 'score_drop',
        message: `${score.name} score dropped ${drop.toFixed(0)} points (${prevScore.toFixed(0)} → ${score.compositeScore.toFixed(0)})`,
        score: score.compositeScore,
        previousScore: prevScore,
        dismissed: false,
      });
    } else if (prevScore < 50 && score.compositeScore >= 75) {
      alerts.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mintUrl: score.url,
        mintName: score.name,
        type: 'recovery',
        message: `${score.name} recovered to SAFE (${score.compositeScore.toFixed(0)}/100)`,
        score: score.compositeScore,
        previousScore: prevScore,
        dismissed: false,
      });
    }
  }

  return alerts;
}

/**
 * Build migration_executed alerts for auto-mode migrations that have been
 * computed and are about to be executed.
 */
export function generateAutoMigrationAlerts(
  plans: MigrationPlan[],
  scores: MintScore[],
): TrustAlert[] {
  return plans.map((plan) => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    mintUrl: plan.fromMint,
    mintName: plan.fromName,
    type: 'migration_executed' as const,
    message: `Auto-migrating ${plan.amount.toLocaleString()} sats from ${plan.fromName} to ${plan.toName}: ${plan.reason}`,
    score: scores.find((s) => s.url === plan.fromMint)?.compositeScore ?? 0,
    dismissed: false,
    actionTaken: 'migrated' as const,
  }));
}

/**
 * Build migration_suggested alerts for alert-mode (human reviews, then approves).
 */
export function generateAlertModeSuggestions(
  plans: MigrationPlan[],
  scores: MintScore[],
): TrustAlert[] {
  return plans.map((plan) => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    mintUrl: plan.fromMint,
    mintName: plan.fromName,
    type: 'migration_suggested' as const,
    message: `Suggested: move ${plan.amount.toLocaleString()} sats from ${plan.fromName} to ${plan.toName}. ${plan.reason}`,
    score: scores.find((s) => s.url === plan.fromMint)?.compositeScore ?? 0,
    dismissed: false,
    actionTaken: 'pending' as const,
  }));
}

export interface SimulationAlertResult {
  alerts: TrustAlert[];
  migrationEvents: MigrationEvent[];
}

/**
 * Generate all alerts and migration events for a simulation scenario run.
 * Unifies the previously duplicated alert logic in SimulationPanel and store.
 */
export function generateSimulationAlerts(
  simulatedScores: MintScore[],
  liveScores: MintScore[],
  automationMode: AutomationMode,
  totalBalance: number,
): SimulationAlertResult {
  const alerts: TrustAlert[] = [];
  const migrationEvents: MigrationEvent[] = [];

  const criticalMints = simulatedScores.filter((s) => s.grade === 'critical');

  for (const mint of criticalMints) {
    const liveMint = liveScores.find((m) => m.url === mint.url);
    alerts.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      mintUrl: mint.url,
      mintName: mint.name,
      type: 'critical',
      message: `[SIM] ${mint.name} dropped to CRITICAL (${mint.compositeScore.toFixed(0)}/100). ${
        automationMode === 'auto' ? 'Auto-migrating funds...' : 'Action required.'
      }`,
      score: mint.compositeScore,
      previousScore: liveMint?.compositeScore ?? 0,
      dismissed: false,
      actionTaken: automationMode === 'auto' ? 'migrated' : 'pending',
    });

    if (automationMode === 'auto') {
      const safeMints = simulatedScores.filter((s) => s.grade === 'safe');
      if (safeMints.length > 0) {
        const target = [...safeMints].sort((a, b) => b.compositeScore - a.compositeScore)[0];
        migrationEvents.push({
          id: crypto.randomUUID(),
          fromMint: mint.name,
          toMint: target.name,
          amount: Math.max(1, Math.floor(totalBalance * 0.1 * Math.random())),
          reason: `Trust score ${mint.compositeScore.toFixed(0)} < 50 (critical threshold)`,
          timestamp: new Date().toISOString(),
          status: 'completed',
        });
      }
    }
  }

  if (automationMode === 'alert' && criticalMints.length > 0) {
    const safeMints = simulatedScores.filter((s) => s.grade === 'safe');
    if (safeMints.length > 0) {
      const target = [...safeMints].sort((a, b) => b.compositeScore - a.compositeScore)[0];
      alerts.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mintUrl: criticalMints[0].url,
        mintName: criticalMints[0].name,
        type: 'migration_suggested',
        message: `[SIM] Recommended: migrate funds from ${criticalMints.map((m) => m.name).join(', ')} to ${target.name} (score: ${target.compositeScore.toFixed(0)})`,
        score: criticalMints[0].compositeScore,
        dismissed: false,
        actionTaken: 'pending',
      });
    }
  }

  return { alerts, migrationEvents };
}

/**
 * Generate a degradation-step alert for progressive simulation.
 */
export function generateDegradationAlert(
  mint: MintScore,
  stepLabel: string,
  liveScore: number,
  automationMode: AutomationMode,
): TrustAlert {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    mintUrl: mint.url,
    mintName: mint.name,
    type: mint.grade === 'critical' ? 'critical' : 'score_drop',
    message: `[SIM] ${stepLabel} — Score: ${mint.compositeScore.toFixed(0)}/100`,
    score: mint.compositeScore,
    previousScore: liveScore,
    dismissed: false,
    actionTaken: mint.grade === 'critical' && automationMode === 'auto' ? 'migrated' : 'pending',
  };
}
