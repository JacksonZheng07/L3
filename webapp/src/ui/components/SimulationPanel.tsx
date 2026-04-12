import { useState, useCallback, useRef } from 'react';
import { useStore } from '../../state/store';
import type { MintScore, SignalResult } from '../../state/types';
import { computeAllocation } from '../../core/trustEngine';
import { FlaskConical, Play, RotateCcw, AlertTriangle, TrendingDown, Zap, Shield, Timer, Users } from 'lucide-react';

// ── Helpers: clone + perturb real scores ─────────────────────

/** Deep-clone a MintScore and override specific signal values */
function perturbScore(
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

  const compositeScore = Math.round(
    newSignals.reduce((s, r) => s + r.contribution, 0) * 1000,
  ) / 10;
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
    isOnline: (overrides.availability ?? original.signals.find(s => s.name === 'availability')?.value ?? 1) > 0.5,
    latencyMs: overrides.latency !== undefined
      ? Math.round(200 + (1 - overrides.latency) * 3000)
      : original.latencyMs,
  };
}

// ── Preset Scenarios (operate on live scores) ─────────────────

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: typeof AlertTriangle;
  color: string;
  /** Takes current live scores as input, returns perturbed scores */
  generate: (liveScores: MintScore[]) => MintScore[];
}

function buildScenarios(): Scenario[] {
  return [
    {
      id: 'healthy',
      name: 'All Mints Healthy',
      description: 'Boosts all current mints to healthy levels. Shows balanced allocation across reliable operators.',
      icon: Shield,
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
      description: 'First mint goes offline. L3 detects it, drops its score to critical, reallocates funds to healthy mints.',
      icon: AlertTriangle,
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
      description: 'Allium detects -60% reserve decline + wash trading on the top-scored mint. Still online — only on-chain intel catches it.',
      icon: TrendingDown,
      color: '#f85149',
      generate: (live) => {
        if (live.length === 0) return [];
        // Target the highest-scored mint for maximum drama
        const sorted = [...live].sort((a, b) => b.compositeScore - a.compositeScore);
        const targetUrl = sorted[0]?.url;
        const scores = live.map((m) => {
          if (m.url === targetUrl) {
            return perturbScore(m, {
              operator_identity: 0.2,
              reserve_behavior: 0.05,
              transaction_patterns: 0.1,
              counterparty_network: 0.1,
              // Direct probes still look fine — that's the point
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
      description: 'Half the mints degrade simultaneously. L3 concentrates allocation onto remaining safe mints (capped at 40%).',
      icon: Zap,
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
      description: 'Amplifies the gap: top 3 mints boosted to near-perfect, bottom 3 degraded to critical. Shows allocation concentration.',
      icon: Users,
      color: '#3fb950',
      generate: (live) => {
        if (live.length < 2) return computeAllocation(live);
        const sorted = [...live].sort((a, b) => b.compositeScore - a.compositeScore);
        const topUrls = new Set(sorted.slice(0, 3).map((m) => m.url));
        const bottomUrls = new Set(sorted.slice(-3).map((m) => m.url));
        const scores = live.map((m) => {
          if (topUrls.has(m.url)) {
            return perturbScore(m, {
              availability: 1.0, latency: 0.95, keyset_stability: 1.0,
              tx_success_rate: 0.99, protocol_version: 1.0,
              operator_identity: 0.9, reserve_behavior: 0.9,
              transaction_patterns: 0.85, counterparty_network: 0.8,
            });
          }
          if (bottomUrls.has(m.url)) {
            return perturbScore(m, {
              availability: 0.0, latency: 0.1, keyset_stability: 0.0,
              tx_success_rate: 0.3, protocol_version: 0.2,
              operator_identity: 0.05, reserve_behavior: 0.05,
              transaction_patterns: 0.1, counterparty_network: 0.05,
            });
          }
          return { ...m };
        });
        return computeAllocation(scores);
      },
    },
  ];
}

// ── Degradation Steps (applied to a real mint) ────────────────

const DEGRADATION_STEPS: { label: string; overrides: Record<string, number> }[] = [
  { label: 'Step 1: Latency spike', overrides: { latency: 0.3, tx_success_rate: 0.90 } },
  { label: 'Step 2: Health check failures', overrides: { latency: 0.1, tx_success_rate: 0.75, availability: 0.5 } },
  { label: 'Step 3: Reserve drain detected', overrides: { latency: 0.1, tx_success_rate: 0.6, availability: 0.5, reserve_behavior: 0.15, transaction_patterns: 0.2 } },
  { label: 'Step 4: Keyset changed!', overrides: { latency: 0.0, tx_success_rate: 0.4, availability: 0.0, reserve_behavior: 0.05, transaction_patterns: 0.1, keyset_stability: 0.0 } },
];

// ── Component ──────────────────────────────────────────────────

export default function SimulationPanel() {
  const { state, dispatch, effectiveScores } = useStore();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [degradationStep, setDegradationStep] = useState(0);
  const degradationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use live (non-simulation) scores as the baseline
  const liveScores = state.scores;
  const hasLiveData = liveScores.length > 0;

  const scenarios = buildScenarios();

  const runScenario = useCallback((scenario: Scenario) => {
    if (!hasLiveData) return;
    if (degradationTimer.current) {
      clearTimeout(degradationTimer.current);
      degradationTimer.current = null;
    }
    setDegradationStep(0);
    setActiveScenario(scenario.id);
    dispatch({ type: 'SET_SIMULATION_ACTIVE', active: true });

    const scores = scenario.generate(liveScores);
    dispatch({ type: 'SET_SIMULATION_SCORES', scores });

    // Generate alerts for critical mints
    const criticalMints = scores.filter(s => s.grade === 'critical');
    for (const mint of criticalMints) {
      const liveMint = liveScores.find(m => m.url === mint.url);
      dispatch({
        type: 'ADD_ALERT',
        alert: {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          mintUrl: mint.url,
          mintName: mint.name,
          type: 'critical',
          message: `[SIM] ${mint.name} dropped to CRITICAL (${mint.compositeScore.toFixed(0)}/100). ${
            state.automationMode === 'auto' ? 'Auto-migrating funds...' : 'Action required.'
          }`,
          score: mint.compositeScore,
          previousScore: liveMint?.compositeScore ?? 0,
          dismissed: false,
          actionTaken: state.automationMode === 'auto' ? 'migrated' : 'pending',
        },
      });

      if (state.automationMode === 'auto') {
        const safeMints = scores.filter(s => s.grade === 'safe');
        if (safeMints.length > 0) {
          const target = safeMints.sort((a, b) => b.compositeScore - a.compositeScore)[0];
          dispatch({
            type: 'ADD_MIGRATION',
            event: {
              id: crypto.randomUUID(),
              fromMint: mint.name,
              toMint: target.name,
              amount: Math.floor(state.totalBalance * 0.1 * Math.random() + 1),
              reason: `Trust score ${mint.compositeScore.toFixed(0)} < 50 (critical threshold)`,
              timestamp: new Date().toISOString(),
              status: 'completed',
            },
          });
        }
      }
    }

    if (state.automationMode === 'alert' && criticalMints.length > 0) {
      const safeMints = scores.filter(s => s.grade === 'safe');
      if (safeMints.length > 0) {
        const target = safeMints.sort((a, b) => b.compositeScore - a.compositeScore)[0];
        dispatch({
          type: 'ADD_ALERT',
          alert: {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            mintUrl: criticalMints[0].url,
            mintName: criticalMints[0].name,
            type: 'migration_suggested',
            message: `[SIM] Recommended: migrate funds from ${criticalMints.map(m => m.name).join(', ')} to ${target.name} (score: ${target.compositeScore.toFixed(0)})`,
            score: criticalMints[0].compositeScore,
            dismissed: false,
            actionTaken: 'pending',
          },
        });
      }
    }
  }, [dispatch, state.automationMode, state.totalBalance, liveScores, hasLiveData]);

  // ── Progressive Degradation (uses a real mint) ──────────────
  const runProgressiveDegradation = useCallback(() => {
    if (!hasLiveData) return;
    setActiveScenario('progressive');
    dispatch({ type: 'SET_SIMULATION_ACTIVE', active: true });
    setDegradationStep(0);

    // Pick the highest-scored mint as the degradation target
    const sorted = [...liveScores].sort((a, b) => b.compositeScore - a.compositeScore);
    const targetUrl = sorted[0]?.url;

    const runStep = (step: number) => {
      if (step >= DEGRADATION_STEPS.length) return;
      setDegradationStep(step + 1);

      const scores = liveScores.map((m) => {
        if (m.url === targetUrl) {
          return perturbScore(m, DEGRADATION_STEPS[step].overrides, `${m.name} (DEGRADING)`);
        }
        return { ...m };
      });

      const allocated = computeAllocation(scores);
      dispatch({ type: 'SET_SIMULATION_SCORES', scores: allocated });

      const degradingMint = allocated.find(s => s.url === targetUrl)!;
      const liveOriginal = liveScores.find(s => s.url === targetUrl);
      dispatch({
        type: 'ADD_ALERT',
        alert: {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          mintUrl: degradingMint.url,
          mintName: degradingMint.name,
          type: degradingMint.grade === 'critical' ? 'critical' : 'score_drop',
          message: `[SIM] ${DEGRADATION_STEPS[step].label} — Score: ${degradingMint.compositeScore.toFixed(0)}/100`,
          score: degradingMint.compositeScore,
          previousScore: liveOriginal?.compositeScore ?? 0,
          dismissed: false,
          actionTaken: degradingMint.grade === 'critical' && state.automationMode === 'auto' ? 'migrated' : 'pending',
        },
      });

      if (degradingMint.grade === 'critical' && state.automationMode === 'auto') {
        const safeMints = allocated.filter(s => s.grade === 'safe');
        if (safeMints.length > 0) {
          const target = safeMints.sort((a, b) => b.compositeScore - a.compositeScore)[0];
          dispatch({
            type: 'ADD_MIGRATION',
            event: {
              id: crypto.randomUUID(),
              fromMint: degradingMint.name,
              toMint: target.name,
              amount: Math.floor(state.totalBalance * 0.15 * Math.random() + 1),
              reason: `Progressive degradation: ${DEGRADATION_STEPS[step].label}`,
              timestamp: new Date().toISOString(),
              status: 'completed',
            },
          });
        }
      }

      if (step < DEGRADATION_STEPS.length - 1) {
        degradationTimer.current = setTimeout(() => runStep(step + 1), 3000);
      }
    };

    runStep(0);
  }, [dispatch, state.automationMode, state.totalBalance, liveScores, hasLiveData]);

  const resetSimulation = useCallback(() => {
    if (degradationTimer.current) {
      clearTimeout(degradationTimer.current);
      degradationTimer.current = null;
    }
    setDegradationStep(0);
    dispatch({ type: 'SET_SIMULATION_ACTIVE', active: false });
    dispatch({ type: 'SET_SIMULATION_SCORES', scores: null });
    setActiveScenario(null);
  }, [dispatch]);

  return (
    <div className="rounded-lg border-2 border-dashed border-[#a855f7]/30 bg-[#a855f7]/[0.03] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-[#a855f7]" />
          <h3 className="text-sm font-mono font-bold text-[#a855f7] uppercase tracking-wider">
            Simulation Mode
          </h3>
          {state.simulationActive && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30 animate-pulse">
              ACTIVE
            </span>
          )}
        </div>
        {state.simulationActive && (
          <button
            onClick={resetSimulation}
            className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] transition-colors"
          >
            <RotateCcw size={10} /> Reset to Live
          </button>
        )}
      </div>

      <p className="text-[11px] font-mono text-[#8b949e] mb-4 leading-relaxed">
        Perturb live mint scores to simulate failures. Scenarios use your real scored mints as the baseline — no hardcoded data.
      </p>

      {/* No live data warning */}
      {!hasLiveData && (
        <div className="mb-4 rounded-lg border border-[#d29922]/30 bg-[#d29922]/10 p-3 text-[11px] font-mono text-[#d29922]">
          Waiting for live scoring data… Simulations will be available once at least one scoring cycle completes.
        </div>
      )}

      {/* Progressive Degradation — Highlighted */}
      <div className="mb-4">
        <button
          onClick={runProgressiveDegradation}
          disabled={!hasLiveData}
          className={`w-full text-left rounded-lg border-2 p-4 transition-all duration-200 ${
            !hasLiveData
              ? 'border-[#30363d] bg-[#161b22] opacity-50 cursor-not-allowed'
              : activeScenario === 'progressive'
                ? 'border-[#f85149]/50 bg-[#f85149]/10 shadow-[0_0_25px_rgba(248,81,73,0.15)]'
                : 'border-[#f85149]/30 border-dashed bg-[#f85149]/[0.03] hover:border-[#f85149]/50 hover:bg-[#f85149]/5'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Timer size={16} className="text-[#f85149]" />
            <span className="text-sm font-mono font-bold text-[#f85149]">
              Simulate Progressive Degradation
            </span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/30">
              KEY DEMO
            </span>
          </div>
          <p className="text-[10px] font-mono text-[#8b949e] leading-relaxed mb-2">
            Targets your highest-scored mint and degrades it over 4 steps: latency spike → health check failures →
            reserve drain (Allium detects) → keyset change. Score drops below 50 — migration triggers automatically.
          </p>
          <div className="flex items-center gap-1 text-[10px] font-mono text-[#f85149]">
            <Play size={10} /> Click to start 12-second progressive simulation
          </div>
        </button>

        {/* Degradation progress indicator */}
        {activeScenario === 'progressive' && degradationStep > 0 && (
          <div className="mt-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
            <div className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider mb-2">
              Degradation Progress
            </div>
            <div className="space-y-2">
              {DEGRADATION_STEPS.map((step, i) => {
                const isActive = degradationStep === i + 1;
                const isDone = degradationStep > i + 1;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-[10px] font-mono transition-all duration-300 ${
                      isActive ? 'text-[#f85149] font-semibold' : isDone ? 'text-[#8b949e]' : 'text-[#8b949e]/40'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] border transition-all ${
                        isDone
                          ? 'bg-[#f85149]/20 border-[#f85149]/50 text-[#f85149]'
                          : isActive
                            ? 'bg-[#f85149]/20 border-[#f85149] text-[#f85149] animate-pulse'
                            : 'bg-[#21262d] border-[#30363d] text-[#8b949e]/40'
                      }`}
                    >
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((scenario) => {
          const Icon = scenario.icon;
          const isActive = activeScenario === scenario.id;

          return (
            <button
              key={scenario.id}
              onClick={() => runScenario(scenario)}
              disabled={!hasLiveData}
              className={`text-left rounded-lg border p-3 transition-all duration-200 ${
                !hasLiveData
                  ? 'border-[#30363d] bg-[#161b22] opacity-50 cursor-not-allowed'
                  : isActive
                    ? 'border-[#a855f7]/50 bg-[#a855f7]/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                    : 'border-[#30363d] bg-[#161b22] hover:border-[#a855f7]/30 hover:bg-[#161b22]/80'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: scenario.color }} />
                <span className="text-xs font-mono font-semibold text-[#c9d1d9]">
                  {scenario.name}
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                {scenario.description}
              </p>
              <div className="flex items-center gap-1 mt-2 text-[9px] font-mono text-[#a855f7]">
                <Play size={8} /> Run scenario
              </div>
            </button>
          );
        })}
      </div>

      {/* Algorithm Output */}
      {state.simulationActive && effectiveScores.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <h4 className="text-[11px] font-mono font-semibold text-[#a855f7] uppercase tracking-wider mb-3">
            Algorithm Output
          </h4>
          <div className="space-y-1 text-[10px] font-mono text-[#8b949e]">
            <div>
              <span className="text-[#c9d1d9]">T(m)</span> = Sum(w_i * n_i(m)) * 100
            </div>
            <div>
              <span className="text-[#c9d1d9]">alloc(m_i)</span> = min(0.40, T_i / Sum(T_eligible))
            </div>
            <div>
              <span className="text-[#c9d1d9]">Migration trigger</span>: T(m) {'<'} 50 AND exists target with T {'>='} 60 (hysteresis = 10)
            </div>
            <div className="pt-2 border-t border-[#21262d] mt-2">
              Safe: {effectiveScores.filter(s => s.grade === 'safe').length} |{' '}
              Warning: {effectiveScores.filter(s => s.grade === 'warning').length} |{' '}
              Critical: {effectiveScores.filter(s => s.grade === 'critical').length} |{' '}
              <span className="text-[#c9d1d9]">
                Mode: {state.automationMode === 'auto' ? 'Auto-Migrate' : state.automationMode === 'alert' ? 'Alert Only' : 'Manual (Dashboard)'}
              </span>
            </div>
            {/* VaR calculation using real balance */}
            {(() => {
              const totalExposure = state.totalBalance;
              const portfolioVaR = effectiveScores.reduce((sum, mint) => {
                const exposure = (mint.allocationPct / 100) * totalExposure;
                return sum + exposure * (1 - mint.compositeScore / 100);
              }, 0);
              return (
                <div className="text-[#d29922]">
                  Portfolio VaR ({totalExposure.toLocaleString()} sats): {Math.round(portfolioVaR).toLocaleString()} sats at risk
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
