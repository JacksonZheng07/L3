/**
 * L3 Simulation Engine — all simulation math, no React.
 * Extracted from SimulationPanel so UI components contain only rendering logic.
 */

import type { MintScore, SignalResult } from '../state/types';
import { computeAllocation } from './trustEngine';

/**
 * Deep-clone a MintScore and override specific signal values.
 * Recalculates composite score and grade from the new signal values.
 */
export function perturbScore(
  original: MintScore,
  overrides: Record<string, number>,
  nameOverride?: string,
): MintScore {
  const newSignals: SignalResult[] = original.signals.map((sig) => {
    if (sig.name in overrides) {
      const newValue = Math.max(0, Math.min(1, overrides[sig.name]));
      return {
        ...sig,
        value: Math.round(newValue * 1000) / 1000,
        contribution: Math.round(newValue * sig.weight * 10000) / 10000,
        explanation: `[SIM] Perturbed from ${sig.value.toFixed(2)} → ${newValue.toFixed(2)}`,
      };
    }
    return { ...sig };
  });

  const compositeScore =
    Math.round(newSignals.reduce((s, r) => s + r.contribution, 0) * 1000) / 10;
  const grade: MintScore['grade'] =
    compositeScore >= 75 ? 'safe' : compositeScore >= 50 ? 'warning' : 'critical';

  return {
    ...original,
    name: nameOverride ?? original.name,
    signals: newSignals,
    compositeScore,
    grade,
    allocationPct: 0,
    scoredAt: new Date().toISOString(),
    isOnline:
      (overrides.availability ??
        original.signals.find((s) => s.name === 'availability')?.value ??
        1) > 0.5,
    latencyMs:
      overrides.latency !== undefined
        ? Math.round(200 + (1 - overrides.latency) * 3000)
        : original.latencyMs,
  };
}

/** Icon key for scenario cards — mapped to lucide components in the UI layer */
export type ScenarioIconKey =
  | 'AlertTriangle'
  | 'TrendingDown'
  | 'Zap'
  | 'Shield'
  | 'Users'
  | 'Timer';

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  iconKey: ScenarioIconKey;
  color: string;
  /** Takes live scores as input, returns perturbed + re-allocated scores */
  generate: (liveScores: MintScore[]) => MintScore[];
}

/** Build all preset simulation scenarios */
export function buildScenarios(): ScenarioDef[] {
  return [
    {
      id: 'healthy',
      name: 'All Mints Healthy',
      description:
        'Boosts all current mints to healthy levels. Shows balanced allocation across reliable operators.',
      iconKey: 'Shield',
      color: '#3fb950',
      generate: (live) =>
        computeAllocation(
          live.map((m) =>
            perturbScore(m, {
              availability: 1.0,
              latency: 0.7 + Math.random() * 0.3,
              keyset_stability: 1.0,
              tx_success_rate: 0.95 + Math.random() * 0.05,
              protocol_version: 1.0,
              reserve_behavior: 0.6 + Math.random() * 0.4,
              transaction_patterns: 0.6 + Math.random() * 0.4,
            }),
          ),
        ),
    },
    {
      id: 'single_failure',
      name: 'Single Mint Failure',
      description:
        'First mint goes offline. L3 detects it, drops its score to critical, reallocates funds to healthy mints.',
      iconKey: 'AlertTriangle',
      color: '#f85149',
      generate: (live) => {
        if (live.length === 0) return [];
        const scores = live.map((m, i) => {
          if (i === 0) {
            return perturbScore(m, {
              availability: 0.0,
              latency: 0.0,
              keyset_stability: 0.0,
              tx_success_rate: 0.3,
              protocol_version: 0.0,
              operator_identity: 0.0,
              reserve_behavior: 0.1,
              transaction_patterns: 0.1,
              counterparty_network: 0.0,
            });
          }
          return perturbScore(m, {
            availability: 1.0,
            latency: 0.7 + Math.random() * 0.3,
            keyset_stability: 1.0,
            tx_success_rate: 0.95 + Math.random() * 0.05,
          });
        });
        return computeAllocation(scores);
      },
    },
    {
      id: 'reserve_drain',
      name: 'Reserve Drain (Rug Pull)',
      description:
        'Allium detects -60% reserve decline + wash trading on the top-scored mint. Still online — only on-chain intel catches it.',
      iconKey: 'TrendingDown',
      color: '#f85149',
      generate: (live) => {
        if (live.length === 0) return [];
        const sorted = [...live].sort((a, b) => b.compositeScore - a.compositeScore);
        const targetUrl = sorted[0]?.url;
        const scores = live.map((m) => {
          if (m.url === targetUrl) {
            return perturbScore(m, {
              operator_identity: 0.2,
              reserve_behavior: 0.05,
              transaction_patterns: 0.1,
              counterparty_network: 0.1,
              availability: 1.0,
              latency: 0.8,
              keyset_stability: 1.0,
              tx_success_rate: 0.85,
            });
          }
          return { ...m };
        });
        return computeAllocation(scores);
      },
    },
    {
      id: 'cascade',
      name: 'Cascade Failure',
      description:
        'Half the mints degrade simultaneously. L3 concentrates allocation onto remaining safe mints (capped at 40%).',
      iconKey: 'Zap',
      color: '#d29922',
      generate: (live) => {
        const halfPoint = Math.ceil(live.length / 2);
        const scores = live.map((m, i) => {
          if (i < halfPoint) {
            return perturbScore(m, {
              availability: Math.random() > 0.5 ? 0.0 : 1.0,
              latency: Math.random() * 0.3,
              keyset_stability: Math.random() > 0.6 ? 0.0 : 1.0,
              tx_success_rate: 0.3 + Math.random() * 0.4,
              protocol_version: 0.2,
              operator_identity: Math.random() * 0.3,
              reserve_behavior: Math.random() * 0.3,
              transaction_patterns: Math.random() * 0.4,
              counterparty_network: Math.random() * 0.2,
            });
          }
          return perturbScore(m, {
            availability: 1.0,
            latency: 0.8 + Math.random() * 0.2,
            keyset_stability: 1.0,
            tx_success_rate: 0.97 + Math.random() * 0.03,
          });
        });
        return computeAllocation(scores);
      },
    },
    {
      id: 'best_vs_worst',
      name: 'Best vs Worst',
      description:
        'Amplifies the gap: top 3 mints boosted to near-perfect, bottom 3 degraded to critical. Shows allocation concentration.',
      iconKey: 'Users',
      color: '#3fb950',
      generate: (live) => {
        if (live.length < 2) return computeAllocation(live);
        const sorted = [...live].sort((a, b) => b.compositeScore - a.compositeScore);
        const topUrls = new Set(sorted.slice(0, 3).map((m) => m.url));
        const bottomUrls = new Set(sorted.slice(-3).map((m) => m.url));
        const scores = live.map((m) => {
          if (topUrls.has(m.url)) {
            return perturbScore(m, {
              availability: 1.0,
              latency: 0.95,
              keyset_stability: 1.0,
              tx_success_rate: 0.99,
              protocol_version: 1.0,
              operator_identity: 0.9,
              reserve_behavior: 0.9,
              transaction_patterns: 0.85,
              counterparty_network: 0.8,
            });
          }
          if (bottomUrls.has(m.url)) {
            return perturbScore(m, {
              availability: 0.0,
              latency: 0.1,
              keyset_stability: 0.0,
              tx_success_rate: 0.3,
              protocol_version: 0.2,
              operator_identity: 0.05,
              reserve_behavior: 0.05,
              transaction_patterns: 0.1,
              counterparty_network: 0.05,
            });
          }
          return { ...m };
        });
        return computeAllocation(scores);
      },
    },
  ];
}

/** Four-step degradation sequence applied to the highest-scored mint */
export const DEGRADATION_STEPS: { label: string; overrides: Record<string, number> }[] = [
  { label: 'Step 1: Latency spike', overrides: { latency: 0.3, tx_success_rate: 0.9 } },
  {
    label: 'Step 2: Health check failures',
    overrides: { latency: 0.1, tx_success_rate: 0.75, availability: 0.5 },
  },
  {
    label: 'Step 3: Reserve drain detected',
    overrides: {
      latency: 0.1,
      tx_success_rate: 0.6,
      availability: 0.5,
      reserve_behavior: 0.15,
      transaction_patterns: 0.2,
    },
  },
  {
    label: 'Step 4: Keyset changed!',
    overrides: {
      latency: 0.0,
      tx_success_rate: 0.4,
      availability: 0.0,
      reserve_behavior: 0.05,
      transaction_patterns: 0.1,
      keyset_stability: 0.0,
    },
  },
];
