import { useState, useCallback, useRef } from 'react';
import { useStore } from '../../state/store';
import { buildScenarios, perturbScore, DEGRADATION_STEPS } from '../../core/simulationEngine';
import { generateSimulationAlerts, generateDegradationAlert } from '../../core/alertEngine';
import { computeAllocation } from '../../core/trustEngine';
import { walletApi } from '../../core/walletApi';
import {
  AlertTriangle,
  TrendingDown,
  Zap,
  Shield,
  Users,
  Timer,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ScenarioIconKey } from '../../core/simulationEngine';

/** Map icon keys (from simulationEngine) to lucide components */
const ICON_MAP: Record<ScenarioIconKey, LucideIcon> = {
  AlertTriangle,
  TrendingDown,
  Zap,
  Shield,
  Users,
  Timer,
};

export default function SimulationPanel() {
  const { state, dispatch, effectiveScores } = useStore();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [degradationStep, setDegradationStep] = useState(0);
  const degradationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveScores = state.scores;
  const hasLiveData = liveScores.length > 0;
  const scenarios = buildScenarios();

  const runScenario = useCallback(
    (scenarioId: string) => {
      if (!hasLiveData) return;
      const scenario = scenarios.find((s) => s.id === scenarioId);
      if (!scenario) return;

      if (degradationTimer.current) {
        clearTimeout(degradationTimer.current);
        degradationTimer.current = null;
      }
      setDegradationStep(0);
      setActiveScenario(scenario.id);
      dispatch({ type: 'SET_SIMULATION_ACTIVE', active: true });

      const scores = scenario.generate(liveScores);
      dispatch({ type: 'SET_SIMULATION_SCORES', scores });

      const { alerts, migrationEvents } = generateSimulationAlerts(
        scores,
        liveScores,
        state.automationMode,
        state.totalBalance,
      );
      alerts.forEach((alert) => dispatch({ type: 'ADD_ALERT', alert }));
      migrationEvents.forEach((event) => dispatch({ type: 'ADD_MIGRATION', event }));

      // Send extreme simulation alerts to Discord
      const extremeAlerts = alerts.filter(
        (a) => a.type === 'critical' || a.type === 'migration_suggested' || a.type === 'migration_executed',
      );
      if (extremeAlerts.length > 0) {
        walletApi.notifyDiscord(extremeAlerts).catch((err) =>
          console.warn('[L3] Discord simulation notification failed:', err),
        );
      }
    },
    [dispatch, state.automationMode, state.totalBalance, liveScores, hasLiveData, scenarios],
  );

  const runProgressiveDegradation = useCallback(() => {
    if (!hasLiveData) return;
    setActiveScenario('progressive');
    dispatch({ type: 'SET_SIMULATION_ACTIVE', active: true });
    setDegradationStep(0);

    const sorted = [...liveScores].sort((a, b) => b.compositeScore - a.compositeScore);
    const targetUrl = sorted[0]?.url;

    const runStep = (step: number) => {
      if (step >= DEGRADATION_STEPS.length) return;
      setDegradationStep(step + 1);

      const scores = liveScores.map((m) =>
        m.url === targetUrl
          ? perturbScore(m, DEGRADATION_STEPS[step].overrides, `${m.name} (DEGRADING)`)
          : { ...m },
      );
      const allocated = computeAllocation(scores);
      dispatch({ type: 'SET_SIMULATION_SCORES', scores: allocated });

      const degradingMint = allocated.find((s) => s.url === targetUrl)!;
      const liveOriginal = liveScores.find((s) => s.url === targetUrl);

      const alert = generateDegradationAlert(
        degradingMint,
        DEGRADATION_STEPS[step].label,
        liveOriginal?.compositeScore ?? 0,
        state.automationMode,
      );
      dispatch({ type: 'ADD_ALERT', alert });

      // Send critical degradation steps to Discord
      if (alert.type === 'critical') {
        walletApi.notifyDiscord([alert]).catch((err) =>
          console.warn('[L3] Discord degradation notification failed:', err),
        );
      }

      if (degradingMint.grade === 'critical' && state.automationMode === 'auto') {
        const safeMints = allocated.filter((s) => s.grade === 'safe');
        if (safeMints.length > 0) {
          const target = [...safeMints].sort((a, b) => b.compositeScore - a.compositeScore)[0];
          dispatch({
            type: 'ADD_MIGRATION',
            event: {
              id: crypto.randomUUID(),
              fromMint: degradingMint.name,
              toMint: target.name,
              amount: Math.max(1, Math.floor(state.totalBalance * 0.15 * Math.random())),
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
    <div className="rounded-xl border-2 border-dashed border-[#a855f7]/30 bg-[#a855f7]/[0.03] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-[#a855f7]" />
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
        Perturb live mint scores to simulate failures. Scenarios use your real scored mints as the
        baseline — no hardcoded data.
      </p>

      {!hasLiveData && (
        <div className="mb-4 rounded-lg border border-[#d29922]/30 bg-[#d29922]/10 p-3 text-[11px] font-mono text-[#d29922]">
          Waiting for live scoring data… Simulations will be available once at least one scoring cycle
          completes.
        </div>
      )}

      {/* Progressive Degradation — highlighted */}
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
            Targets your highest-scored mint and degrades it over 4 steps: latency spike → health
            check failures → reserve drain (Allium detects) → keyset change. Score drops below 50 —
            migration triggers automatically.
          </p>
          <div className="flex items-center gap-1 text-[10px] font-mono text-[#f85149]">
            <Play size={10} /> Click to start 12-second progressive simulation
          </div>
        </button>

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

      {/* Scenario grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((scenario) => {
          const Icon = ICON_MAP[scenario.iconKey];
          const isActive = activeScenario === scenario.id;
          return (
            <button
              key={scenario.id}
              onClick={() => runScenario(scenario.id)}
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

      {/* Algorithm output */}
      {state.simulationActive && effectiveScores.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <h4 className="text-[11px] font-mono font-semibold text-[#a855f7] uppercase tracking-wider mb-3">
            Algorithm Output
          </h4>
          <div className="space-y-1 text-[10px] font-mono text-[#8b949e]">
            <div>
              <span className="text-[#c9d1d9]">T(m)</span> = Sum(w_i × n_i(m)) × 100
            </div>
            <div>
              <span className="text-[#c9d1d9]">alloc(m_i)</span> = min(0.40, T_i / Sum(T_eligible))
            </div>
            <div>
              <span className="text-[#c9d1d9]">Migration trigger</span>: T(m) {'<'} 50 AND target{' '}
              {'>='} 60
            </div>
            <div className="pt-2 border-t border-[#21262d] mt-2">
              Safe: {effectiveScores.filter((s) => s.grade === 'safe').length} | Warning:{' '}
              {effectiveScores.filter((s) => s.grade === 'warning').length} | Critical:{' '}
              {effectiveScores.filter((s) => s.grade === 'critical').length} |{' '}
              <span className="text-[#c9d1d9]">
                Mode:{' '}
                {state.automationMode === 'auto'
                  ? 'Auto-Migrate'
                  : state.automationMode === 'alert'
                  ? 'Alert Only'
                  : 'Manual'}
              </span>
            </div>
            {(() => {
              const portfolioVaR = effectiveScores.reduce((sum, mint) => {
                const exposure = (mint.allocationPct / 100) * state.totalBalance;
                return sum + exposure * (1 - mint.compositeScore / 100);
              }, 0);
              return (
                <div className="text-[#d29922]">
                  Portfolio VaR ({state.totalBalance.toLocaleString()} sats):{' '}
                  {Math.round(portfolioVaR).toLocaleString()} sats at risk
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
