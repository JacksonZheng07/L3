import { useState, useCallback } from 'react';
import { useStore } from '../../state/store';
import type { MintScore, SignalResult, MigrationEvent } from '../../state/types';
import { computeAllocation } from '../../core/trustEngine';
import { MINTS, WEIGHTS } from '../../core/config';
import { FlaskConical, Play, RotateCcw, AlertTriangle, TrendingDown, Zap, Shield } from 'lucide-react';

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
    mockSignal('reserve_behavior', rb, 'allium', rb > 0.7 ? 'Reserves stable and growing' : rb > 0.4 ? 'Minor reserve fluctuations' : 'Significant reserve decline detected'),
    mockSignal('transaction_patterns', tp, 'allium', tp > 0.7 ? 'Healthy diverse transaction patterns' : tp > 0.4 ? 'Moderate activity' : 'Suspicious circular patterns detected'),
    mockSignal('counterparty_network', cp, 'allium', cp > 0.5 ? 'Legitimate DeFi counterparties' : 'Limited counterparty network'),
    mockSignal('availability', av, 'direct', av > 0.5 ? 'Mint online and responding' : 'MINT UNREACHABLE'),
    mockSignal('latency', lat, 'direct', lat > 0.7 ? `Response: ${Math.round(200 + (1 - lat) * 1800)}ms (excellent)` : `Response: ${Math.round(500 + (1 - lat) * 3000)}ms (slow)`),
    mockSignal('keyset_stability', ks, 'direct', ks > 0.5 ? 'Keysets stable' : 'KEYSET CHANGED — possible token invalidation'),
    mockSignal('tx_success_rate', tx, 'direct', `Success rate: ${(tx * 100).toFixed(1)}%`),
    mockSignal('protocol_version', ver, 'direct', ver > 0.7 ? 'Current stable release' : 'Outdated version'),
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
    description: 'Baseline: all mints score 70-95. Balanced allocation across reliable operators.',
    icon: Shield,
    color: '#3fb950',
    generate: () => {
      const scores = MINTS.slice(0, 8).map(m =>
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
      return computeAllocation(scores);
    },
  },
  {
    id: 'single_failure',
    name: 'Single Mint Failure',
    description: 'One mint goes offline. Watch L3 detect it, drop its score to critical, reallocate funds to healthy mints, and trigger migration.',
    icon: AlertTriangle,
    color: '#f85149',
    generate: () => {
      const scores = MINTS.slice(0, 8).map((m, i) => {
        if (i === 2) {
          // This mint goes critical
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
      return computeAllocation(scores);
    },
  },
  {
    id: 'reserve_drain',
    name: 'Reserve Drain (Rug Pull)',
    description: 'Allium detects a -60% reserve decline and suspicious circular transactions on a popular mint. L3 drops it to critical before users notice.',
    icon: TrendingDown,
    color: '#f85149',
    generate: () => {
      const scores = MINTS.slice(0, 8).map((m, i) => {
        if (i === 0) {
          // Popular mint being drained
          return generateMockScore(m.url, m.name, {
            availability: 1.0,  // Still online — looks fine on surface
            latency: 0.8,
            keysetStable: 1.0,
            txSuccess: 0.85,
            version: 1.0,
            operatorId: 0.2,       // Anonymous
            reserveBehavior: 0.05, // Allium catches the drain!
            txPatterns: 0.1,       // Circular wash trading
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
      return computeAllocation(scores);
    },
  },
  {
    id: 'cascade',
    name: 'Cascade Failure',
    description: 'Multiple mints degrade simultaneously. L3 concentrates allocation onto the few remaining safe mints (capped at 40% each for diversification).',
    icon: Zap,
    color: '#d29922',
    generate: () => {
      const scores = MINTS.slice(0, 8).map((m, i) => {
        if (i < 4) {
          // First 4 mints degrade
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
        // Remaining 4 stay healthy
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
      return computeAllocation(scores);
    },
  },
  {
    id: 'progressive_degradation',
    name: 'Progressive Degradation',
    description: 'A mint slowly loses reliability over time. Allium data shows declining reserves while direct probes still show it online — early warning system.',
    icon: TrendingDown,
    color: '#d29922',
    generate: () => {
      const scores = MINTS.slice(0, 8).map((m, i) => {
        if (i === 1) {
          // Slowly degrading mint — online but Allium catches problems
          return generateMockScore(m.url, m.name, {
            availability: 1.0,    // Still online
            latency: 0.6,         // Getting slower
            keysetStable: 1.0,    // Keys stable
            txSuccess: 0.8,       // Some failures starting
            version: 0.5,         // Outdated
            operatorId: 0.3,      // Limited identity
            reserveBehavior: 0.25, // Reserves declining!
            txPatterns: 0.35,     // Activity dropping
            counterparty: 0.2,
          });
        }
        return generateMockScore(m.url, m.name, {
          availability: 1.0,
          latency: 0.7 + Math.random() * 0.3,
          keysetStable: 1.0,
          txSuccess: 0.95 + Math.random() * 0.05,
          version: 1.0,
          operatorId: 0.5 + Math.random() * 0.5,
          reserveBehavior: 0.6 + Math.random() * 0.4,
          txPatterns: 0.6 + Math.random() * 0.4,
          counterparty: 0.4 + Math.random() * 0.5,
        });
      });
      return computeAllocation(scores);
    },
  },
];

// ── Component ──────────────────────────────────────────────────

export default function SimulationPanel() {
  const { state, dispatch, effectiveScores } = useStore();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const runScenario = useCallback((scenario: Scenario) => {
    setIsAnimating(true);
    setActiveScenario(scenario.id);
    dispatch({ type: 'SET_SIMULATION_ACTIVE', active: true });

    // Generate scores
    const scores = scenario.generate();
    dispatch({ type: 'SET_SIMULATION_SCORES', scores });

    // Generate alerts based on scenario
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

      // If auto mode, simulate migration
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

    // If alert mode, suggest migrations
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

    setTimeout(() => setIsAnimating(false), 500);
  }, [dispatch, state.automationMode]);

  const resetSimulation = useCallback(() => {
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
        Run pre-built scenarios with mock data to demonstrate L3's trust scoring algorithm,
        automated migration, and risk detection. All data below is simulated.
      </p>

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

      {/* Math explanation */}
      {state.simulationActive && effectiveScores.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <h4 className="text-[11px] font-mono font-semibold text-[#a855f7] uppercase tracking-wider mb-3">
            Algorithm Output
          </h4>
          <div className="space-y-1 text-[10px] font-mono text-[#8b949e]">
            <div>
              <span className="text-[#c9d1d9]">Composite Score</span> = Sum(signal_value x weight) x 100
            </div>
            <div>
              <span className="text-[#c9d1d9]">Allocation</span> = (score_i / Sum(eligible_scores)) x 100, capped at 40%
            </div>
            <div className="pt-2 border-t border-[#21262d] mt-2">
              Safe: {effectiveScores.filter(s => s.grade === 'safe').length} |{' '}
              Warning: {effectiveScores.filter(s => s.grade === 'warning').length} |{' '}
              Critical: {effectiveScores.filter(s => s.grade === 'critical').length} |{' '}
              <span className="text-[#c9d1d9]">
                Mode: {state.automationMode === 'auto' ? 'Auto-Migrate' : state.automationMode === 'alert' ? 'Alert Only' : 'Manual'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
