import { useState, useCallback, useRef } from 'react';
import { useStore } from '../../state/store';
import type { MintScore, SignalResult } from '../../state/types';
import { computeAllocation } from '../../core/trustEngine';
import { MINTS, WEIGHTS } from '../../core/config';
import { FlaskConical, Play, RotateCcw, AlertTriangle, TrendingDown, Zap, Shield, Timer, Users } from 'lucide-react';

// ── Mock signal generator ──────────────────────────────────────

function mockSignal(
  name: string,
  value: number,
  source: 'allium' | 'direct',
  explanation: string,
): SignalResult {
  const weight = WEIGHTS[name] ?? 0.1;
  return {
    name,
    value: Math.round(value * 1000) / 1000,
    weight,
    contribution: Math.round(value * weight * 10000) / 10000,
    source,
    explanation,
  };
}

function generateMockScore(
  url: string,
  name: string,
  overrides: Partial<{
    availability: number;
    latency: number;
    keysetStable: number;
    txSuccess: number;
    version: number;
    operatorId: number;
    reserveBehavior: number;
    txPatterns: number;
    counterparty: number;
  }> = {},
): MintScore {
  const av = overrides.availability ?? (0.7 + Math.random() * 0.3);
  const lat = overrides.latency ?? (0.5 + Math.random() * 0.5);
  const ks = overrides.keysetStable ?? (Math.random() > 0.15 ? 1.0 : 0.0);
  const tx = overrides.txSuccess ?? (0.8 + Math.random() * 0.2);
  const ver = overrides.version ?? (Math.random() > 0.3 ? 1.0 : 0.5);
  const opId = overrides.operatorId ?? (Math.random() * 0.8);
  const rb = overrides.reserveBehavior ?? (0.3 + Math.random() * 0.7);
  const tp = overrides.txPatterns ?? (0.3 + Math.random() * 0.7);
  const cp = overrides.counterparty ?? (0.2 + Math.random() * 0.6);

  const signals: SignalResult[] = [
    mockSignal('operator_identity', opId, 'allium', opId > 0.6 ? 'Known entity with established history' : opId > 0.3 ? 'Partially identified operator' : 'Anonymous operator'),
    mockSignal('reserve_behavior', rb, 'allium', rb > 0.7 ? 'Reserves stable and growing' : rb > 0.4 ? 'Minor reserve fluctuations' : 'Significant reserve decline detected — ALERT'),
    mockSignal('transaction_patterns', tp, 'allium', tp > 0.7 ? 'Healthy diverse transaction patterns' : tp > 0.4 ? 'Moderate activity' : 'Suspicious circular patterns — possible wash trading'),
    mockSignal('counterparty_network', cp, 'allium', cp > 0.5 ? 'Legitimate DeFi counterparties' : 'Limited counterparty network'),
    mockSignal('availability', av, 'direct', av > 0.5 ? 'Mint online and responding' : 'MINT UNREACHABLE — all operations will fail'),
    mockSignal('latency', lat, 'direct', lat > 0.7 ? `Response: ${Math.round(200 + (1 - lat) * 1800)}ms (excellent)` : `Response: ${Math.round(500 + (1 - lat) * 3000)}ms (degraded)`),
    mockSignal('keyset_stability', ks, 'direct', ks > 0.5 ? 'Keysets stable — no changes detected' : 'KEYSET CHANGED — possible token invalidation attempt'),
    mockSignal('tx_success_rate', tx, 'direct', `Success rate: ${(tx * 100).toFixed(1)}%`),
    mockSignal('protocol_version', ver, 'direct', ver > 0.7 ? 'Current stable release (0.15.x)' : 'Outdated version (0.14.x)'),
  ];

  const compositeScore = Math.round(signals.reduce((s, r) => s + r.contribution, 0) * 1000) / 10;
  const grade: MintScore['grade'] = compositeScore >= 75 ? 'safe' : compositeScore >= 50 ? 'warning' : 'critical';

  return {
    url,
    name,
    isAnonymous: opId < 0.1,
    signals,
    compositeScore,
    grade,
    allocationPct: 0,
    scoredAt: new Date().toISOString(),
    isOnline: av > 0.5,
    latencyMs: Math.round(200 + (1 - lat) * 3000),
    version: ver > 0.7 ? '0.15.3' : '0.14.1',
    keysetCount: ks > 0.5 ? 3 : 1,
  };
}

// ── Fedimint mock score (higher base trust) ──────────────────

function generateFedimintMockScore(): MintScore {
  const signals: SignalResult[] = [
    mockSignal('operator_identity', 0.95, 'allium', 'Federated — 5 known guardians across 5 jurisdictions'),
    mockSignal('reserve_behavior', 0.90, 'allium', 'Multi-sig reserves verified on-chain. No single withdrawal authority.'),
    mockSignal('transaction_patterns', 0.85, 'allium', 'Diverse organic activity across federation members'),
    mockSignal('counterparty_network', 0.80, 'allium', 'Guardians have established entity labels'),
    mockSignal('availability', 1.0, 'direct', 'Federation online (3-of-5 guardians responding)'),
    mockSignal('latency', 0.9, 'direct', 'Response: 280ms (excellent — federation consensus overhead minimal)'),
    mockSignal('keyset_stability', 1.0, 'direct', 'Federation keysets stable (threshold rotation requires 3-of-5)'),
    mockSignal('tx_success_rate', 0.98, 'direct', 'Success rate: 99.2% (federation redundancy)'),
    mockSignal('protocol_version', 1.0, 'direct', 'Current Fedimint stable release'),
  ];

  // +15 base trust bonus for federation architecture
  const baseComposite = Math.round(signals.reduce((s, r) => s + r.contribution, 0) * 1000) / 10;
  const compositeScore = Math.min(100, baseComposite + 15);

  return {
    url: 'https://fed-alpha.example.com',
    name: 'Alpine Federation (Fedimint)',
    isAnonymous: false,
    signals,
    compositeScore,
    grade: 'safe',
    allocationPct: 0,
    scoredAt: new Date().toISOString(),
    isOnline: true,
    latencyMs: 280,
    version: 'fedimint-0.4.2',
    keysetCount: 5,
  };
}

// ── Preset Scenarios ───────────────────────────────────────────

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: typeof AlertTriangle;
  color: string;
  generate: () => MintScore[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'healthy',
    name: 'All Mints Healthy',
    description: 'Baseline: all mints score 70-95. Balanced allocation across reliable operators. Includes a Fedimint federation with higher base trust.',
    icon: Shield,
    color: '#3fb950',
    generate: () => {
      const scores = MINTS.slice(0, 7).map(m =>
        generateMockScore(m.url, m.name, {
          availability: 1.0,
          latency: 0.7 + Math.random() * 0.3,
          keysetStable: 1.0,
          txSuccess: 0.95 + Math.random() * 0.05,
          version: 1.0,
          operatorId: 0.5 + Math.random() * 0.5,
          reserveBehavior: 0.6 + Math.random() * 0.4,
          txPatterns: 0.6 + Math.random() * 0.4,
          counterparty: 0.4 + Math.random() * 0.5,
        })
      );
      scores.push(generateFedimintMockScore());
      return computeAllocation(scores);
    },
  },
  {
    id: 'single_failure',
    name: 'Single Mint Failure',
    description: 'One mint goes offline. L3 detects it, drops its score to critical, reallocates funds to healthy mints, and triggers migration.',
    icon: AlertTriangle,
    color: '#f85149',
    generate: () => {
      const scores = MINTS.slice(0, 7).map((m, i) => {
        if (i === 2) {
          return generateMockScore(m.url, m.name, {
            availability: 0.0,
            latency: 0.0,
            keysetStable: 0.0,
            txSuccess: 0.3,
            version: 0.0,
            operatorId: 0.0,
            reserveBehavior: 0.1,
            txPatterns: 0.1,
            counterparty: 0.0,
          });
        }
        return generateMockScore(m.url, m.name, {
          availability: 1.0,
          latency: 0.7 + Math.random() * 0.3,
          keysetStable: 1.0,
          txSuccess: 0.95 + Math.random() * 0.05,
          version: 1.0,
          operatorId: 0.4 + Math.random() * 0.5,
          reserveBehavior: 0.5 + Math.random() * 0.5,
          txPatterns: 0.5 + Math.random() * 0.5,
          counterparty: 0.3 + Math.random() * 0.5,
        });
      });
      scores.push(generateFedimintMockScore());
      return computeAllocation(scores);
    },
  },
  {
    id: 'reserve_drain',
    name: 'Reserve Drain (Rug Pull)',
    description: 'Allium detects -60% reserve decline + wash trading on a popular mint. L3 drops it to critical before users notice. Still online — only on-chain intel catches it.',
    icon: TrendingDown,
    color: '#f85149',
    generate: () => {
      const scores = MINTS.slice(0, 7).map((m, i) => {
        if (i === 0) {
          return generateMockScore(m.url, m.name, {
            availability: 1.0,
            latency: 0.8,
            keysetStable: 1.0,
            txSuccess: 0.85,
            version: 1.0,
            operatorId: 0.2,
            reserveBehavior: 0.05,
            txPatterns: 0.1,
            counterparty: 0.1,
          });
        }
        return generateMockScore(m.url, m.name, {
          availability: 1.0,
          latency: 0.6 + Math.random() * 0.4,
          keysetStable: 1.0,
          txSuccess: 0.92 + Math.random() * 0.08,
          version: 0.8 + Math.random() * 0.2,
          operatorId: 0.4 + Math.random() * 0.5,
          reserveBehavior: 0.6 + Math.random() * 0.4,
          txPatterns: 0.5 + Math.random() * 0.5,
          counterparty: 0.3 + Math.random() * 0.5,
        });
      });
      scores.push(generateFedimintMockScore());
      return computeAllocation(scores);
    },
  },
  {
    id: 'cascade',
    name: 'Cascade Failure',
    description: 'Multiple mints degrade simultaneously. L3 concentrates allocation onto remaining safe mints (capped at 40% for diversification). Federation absorbs overflow.',
    icon: Zap,
    color: '#d29922',
    generate: () => {
      const scores = MINTS.slice(0, 7).map((m, i) => {
        if (i < 4) {
          return generateMockScore(m.url, m.name, {
            availability: Math.random() > 0.5 ? 0.0 : 1.0,
            latency: Math.random() * 0.3,
            keysetStable: Math.random() > 0.6 ? 0.0 : 1.0,
            txSuccess: 0.3 + Math.random() * 0.4,
            version: 0.2,
            operatorId: Math.random() * 0.3,
            reserveBehavior: Math.random() * 0.3,
            txPatterns: Math.random() * 0.4,
            counterparty: Math.random() * 0.2,
          });
        }
        return generateMockScore(m.url, m.name, {
          availability: 1.0,
          latency: 0.8 + Math.random() * 0.2,
          keysetStable: 1.0,
          txSuccess: 0.97 + Math.random() * 0.03,
          version: 1.0,
          operatorId: 0.6 + Math.random() * 0.4,
          reserveBehavior: 0.7 + Math.random() * 0.3,
          txPatterns: 0.7 + Math.random() * 0.3,
          counterparty: 0.5 + Math.random() * 0.4,
        });
      });
      scores.push(generateFedimintMockScore());
      return computeAllocation(scores);
    },
  },
  {
    id: 'fedimint_advantage',
    name: 'Fedimint vs Cashu',
    description: 'Compare single-operator Cashu mints with a federated Fedimint. Shows the structural trust bonus (+15) from multi-guardian BFT consensus.',
    icon: Users,
    color: '#3fb950',
    generate: () => {
      // 3 Cashu mints with varying quality + 1 Fedimint
      const scores = [
        generateMockScore(MINTS[0].url, 'Cashu Mint A (Good)', {
          availability: 1.0, latency: 0.9, keysetStable: 1.0, txSuccess: 0.98,
          version: 1.0, operatorId: 0.7, reserveBehavior: 0.8, txPatterns: 0.75, counterparty: 0.6,
        }),
        generateMockScore(MINTS[1].url, 'Cashu Mint B (Average)', {
          availability: 1.0, latency: 0.6, keysetStable: 1.0, txSuccess: 0.92,
          version: 0.5, operatorId: 0.4, reserveBehavior: 0.5, txPatterns: 0.5, counterparty: 0.3,
        }),
        generateMockScore(MINTS[2].url, 'Cashu Mint C (Weak)', {
          availability: 1.0, latency: 0.4, keysetStable: 1.0, txSuccess: 0.85,
          version: 0.5, operatorId: 0.1, reserveBehavior: 0.3, txPatterns: 0.3, counterparty: 0.1,
        }),
        generateFedimintMockScore(),
      ];
      return computeAllocation(scores);
    },
  },
];

// ── Component ──────────────────────────────────────────────────

export default function SimulationPanel() {
  const { state, dispatch, effectiveScores } = useStore();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [degradationStep, setDegradationStep] = useState(0);
  const degradationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runScenario = useCallback((scenario: Scenario) => {
    // Stop any progressive degradation in progress
    if (degradationTimer.current) {
      clearTimeout(degradationTimer.current);
      degradationTimer.current = null;
    }
    setDegradationStep(0);

    setActiveScenario(scenario.id);
    dispatch({ type: 'SET_SIMULATION_ACTIVE', active: true });

    const scores = scenario.generate();
    dispatch({ type: 'SET_SIMULATION_SCORES', scores });

    // Generate alerts
    const criticalMints = scores.filter(s => s.grade === 'critical');
    for (const mint of criticalMints) {
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
          previousScore: 78,
          dismissed: false,
          actionTaken: state.automationMode === 'auto' ? 'migrated' : 'pending',
        },
      });

      if (state.automationMode === 'auto') {
        const safeMints = scores.filter(s => s.grade === 'safe');
        if (safeMints.length > 0) {
          const target = safeMints.sort((a, b) => b.compositeScore - a.compositeScore)[0];
          const migrationAmount = Math.floor(1000 + Math.random() * 4000);
          dispatch({
            type: 'ADD_MIGRATION',
            event: {
              id: crypto.randomUUID(),
              fromMint: mint.name,
              toMint: target.name,
              amount: migrationAmount,
              reason: `Trust score ${mint.compositeScore.toFixed(0)} < 50 (critical threshold)`,
              timestamp: new Date().toISOString(),
              status: 'completed',
            },
          });
          dispatch({
            type: 'ADD_ALERT',
            alert: {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              mintUrl: mint.url,
              mintName: mint.name,
              type: 'migration_executed',
              message: `[SIM] Auto-migrated ${migrationAmount.toLocaleString()} sats from ${mint.name} to ${target.name}`,
              score: mint.compositeScore,
              dismissed: false,
              actionTaken: 'migrated',
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

  }, [dispatch, state.automationMode]);

  // ── Progressive Degradation Simulation ───────────────────────
  const DEGRADATION_STEPS = [
    { label: 'Step 1: Latency spike', overrides: { latency: 0.3, txSuccess: 0.90 } },
    { label: 'Step 2: Health check failures', overrides: { latency: 0.1, txSuccess: 0.75, availability: 0.5 } },
    { label: 'Step 3: Reserve drain detected', overrides: { latency: 0.1, txSuccess: 0.6, availability: 0.5, reserveBehavior: 0.15, txPatterns: 0.2 } },
    { label: 'Step 4: Keyset changed!', overrides: { latency: 0.0, txSuccess: 0.4, availability: 0.0, reserveBehavior: 0.05, txPatterns: 0.1, keysetStable: 0.0 } },
  ];

  const runProgressiveDegradation = useCallback(() => {
    setActiveScenario('progressive');
    dispatch({ type: 'SET_SIMULATION_ACTIVE', active: true });
    setDegradationStep(0);

    const runStep = (step: number) => {
      if (step >= DEGRADATION_STEPS.length) return;

      setDegradationStep(step + 1);

      const healthyOverrides = {
        availability: 1.0, latency: 0.8, keysetStable: 1.0, txSuccess: 0.96,
        version: 1.0, operatorId: 0.6, reserveBehavior: 0.7, txPatterns: 0.7, counterparty: 0.5,
      };

      const degradedOverrides = {
        ...healthyOverrides,
        operatorId: 0.3,
        counterparty: 0.2,
        version: 0.5,
        ...DEGRADATION_STEPS[step].overrides,
      };

      const scores = [
        generateMockScore(MINTS[0].url, 'Mint A (Stable)', healthyOverrides),
        generateMockScore(MINTS[1].url, 'Mint B (DEGRADING)', degradedOverrides),
        generateMockScore(MINTS[2].url, 'Mint C (Stable)', healthyOverrides),
        generateFedimintMockScore(),
      ];

      const allocated = computeAllocation(scores);
      dispatch({ type: 'SET_SIMULATION_SCORES', scores: allocated });

      // Alert on the degrading mint
      const degradingMint = allocated.find(s => s.name === 'Mint B (DEGRADING)')!;
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
          previousScore: step > 0 ? 78 - step * 15 : 78,
          dismissed: false,
          actionTaken: degradingMint.grade === 'critical' && state.automationMode === 'auto' ? 'migrated' : 'pending',
        },
      });

      // If critical and auto mode, trigger migration
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
              amount: Math.floor(2000 + Math.random() * 3000),
              reason: `Progressive degradation: ${DEGRADATION_STEPS[step].label}`,
              timestamp: new Date().toISOString(),
              status: 'completed',
            },
          });
        }
      }

      // Schedule next step
      if (step < DEGRADATION_STEPS.length - 1) {
        degradationTimer.current = setTimeout(() => runStep(step + 1), 3000);
      }
    };

    runStep(0);
  }, [dispatch, state.automationMode]);

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
        Run pre-built scenarios with hardcoded mock data to prove L3's trust scoring algorithm works.
        All data is simulated — no real transactions.
      </p>

      {/* Progressive Degradation — Highlighted */}
      <div className="mb-4">
        <button
          onClick={runProgressiveDegradation}
          className={`w-full text-left rounded-lg border-2 p-4 transition-all duration-200 ${
            activeScenario === 'progressive'
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
            Watch a mint's safety rating fall in real-time over 4 steps: latency spike, health check failures,
            reserve drain (Allium detects), keyset change. Score drops below 50 — migration triggers automatically.
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
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const isActive = activeScenario === scenario.id;

          return (
            <button
              key={scenario.id}
              onClick={() => runScenario(scenario)}
              className={`text-left rounded-lg border p-3 transition-all duration-200 ${
                isActive
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
            {/* VaR calculation */}
            {(() => {
              const totalExposure = 100000;
              const portfolioVaR = effectiveScores.reduce((sum, mint) => {
                const exposure = (mint.allocationPct / 100) * totalExposure;
                return sum + exposure * (1 - mint.compositeScore / 100);
              }, 0);
              return (
                <div className="text-[#d29922]">
                  Portfolio VaR (100k sats): {Math.round(portfolioVaR).toLocaleString()} sats at risk
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
