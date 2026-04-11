import { useStore } from '../../state/store';
import TrustSpectrum from '../components/TrustSpectrum';
import ScoreChart from '../components/ScoreChart';
import ThreeCurvesChart from '../components/ThreeCurvesChart';
import AllocationPie from '../components/AllocationPie';
import MigrationLog from '../components/MigrationLog';
import MintCard from '../components/MintCard';
import SimulationPanel from '../components/SimulationPanel';
import AutomationControl from '../components/AutomationControl';
import AlertPanel from '../components/AlertPanel';
import { RefreshCw, Activity, Radio, FlaskConical, Building2 } from 'lucide-react';
import { SCORING_INTERVAL_MS } from '../../core/config';

export default function Home() {
  const { state, runScoring, effectiveScores } = useStore();
  const { balances, isScoring, lastScoredAt, simulationActive } = state;

  const balanceMap = new Map(balances.map((b) => [b.mintUrl, b.balance]));

  const lastScoredLabel = lastScoredAt
    ? new Date(lastScoredAt).toLocaleTimeString()
    : 'never';

  const onlineCount = effectiveScores.filter((s) => s.isOnline).length;
  const pollingSeconds = SCORING_INTERVAL_MS / 1000;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#161b22]/95 backdrop-blur-sm border-b border-[#30363d]">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-0.5">
              <span
                className="text-2xl font-black tracking-tighter"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: 'linear-gradient(135deg, #58a6ff 0%, #a855f7 50%, #22c55e 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                L
              </span>
              <span
                className="text-lg font-black"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: 'linear-gradient(135deg, #a855f7 0%, #22c55e 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  position: 'relative',
                  top: '-6px',
                  fontSize: '14px',
                }}
              >
                3
              </span>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[11px] font-semibold text-[#c9d1d9] tracking-wide" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                LIQUIDITY LIGHTNING
              </span>
              <span className="text-[9px] text-[#8b949e] tracking-widest flex items-center gap-1">
                <Building2 size={8} />
                ENTERPRISE BITCOIN PORTFOLIO MANAGEMENT
              </span>
            </div>
          </div>

          {/* Status + Controls */}
          <div className="flex items-center gap-3">
            {/* Simulation indicator */}
            {simulationActive && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#a855f7] bg-[#a855f7]/10 rounded px-2.5 py-1 border border-[#a855f7]/30 animate-pulse">
                <FlaskConical size={10} />
                <span>SIMULATION</span>
              </div>
            )}

            {/* Live polling indicator */}
            {!simulationActive && (
              <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-[#8b949e] bg-[#21262d] rounded px-2.5 py-1 border border-[#30363d]">
                <Radio size={10} className="text-[#3fb950] animate-pulse" />
                <span>Polling every {pollingSeconds}s</span>
                <span className="text-[#30363d]">|</span>
                <span>{onlineCount}/{effectiveScores.length} online</span>
              </div>
            )}

            {/* Scoring status */}
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">
              {isScoring ? (
                <>
                  <Activity size={12} className="text-[#58a6ff] animate-pulse" />
                  <span className="text-[#58a6ff]">Scoring...</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                  <span>Last: {lastScoredLabel}</span>
                </>
              )}
            </div>

            {/* Re-score button */}
            {!simulationActive && (
              <button
                onClick={() => runScoring()}
                disabled={isScoring}
                className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] hover:border-[#58a6ff]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw size={12} className={isScoring ? 'animate-spin' : ''} />
                Re-score
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Simulation Panel — prominent at top for demo */}
        <SimulationPanel />

        {/* Trust Response Mode + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AutomationControl />
          <AlertPanel />
        </div>

        {/* Trust Spectrum - full width */}
        <TrustSpectrum />

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            <ScoreChart />
            <ThreeCurvesChart />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <AllocationPie />
            <MigrationLog />
          </div>
        </div>

        {/* Mint Cards grid */}
        <div>
          <h3 className="text-sm font-mono font-semibold text-[#8b949e] uppercase tracking-wider mb-4">
            Mint Details ({effectiveScores.length} mints)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {effectiveScores.map((score) => (
              <MintCard
                key={score.url}
                score={score}
                balance={balanceMap.get(score.url)}
              />
            ))}
          </div>
        </div>

        {/* Enterprise pitch footer */}
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-6 text-center">
          <h4 className="text-xs font-mono font-semibold text-[#8b949e] uppercase tracking-widest mb-3">
            Why L3 for Enterprise
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-4xl mx-auto">
            <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
              <div className="text-[11px] font-mono font-semibold text-[#58a6ff] mb-1">On-Chain Verification</div>
              <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                Allium Labs API cross-references operator addresses, reserve balances, and transaction patterns against blockchain data. No self-reported metrics.
              </div>
            </div>
            <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
              <div className="text-[11px] font-mono font-semibold text-[#3fb950] mb-1">Weighted Composite Scoring</div>
              <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                9-signal weighted model: 60% on-chain intelligence (Allium), 40% direct protocol probes. Mathematically transparent. Weights auditable.
              </div>
            </div>
            <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
              <div className="text-[11px] font-mono font-semibold text-[#a855f7] mb-1">Configurable Response</div>
              <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                Auto-migrate, alert-only, or manual. Enterprises control risk tolerance. Fedimint integration planned for federated custody tier.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] font-mono text-[#8b949e]/40 py-6 border-t border-[#21262d]">
          L3 — Liquidity Lightning Load Leveler — MIT Bitcoin Hackathon 2026 — "Freedom for All"
        </footer>
      </main>
    </div>
  );
}
