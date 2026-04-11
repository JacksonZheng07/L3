import { useStore } from '../../state/store';
import TrustSpectrum from '../components/TrustSpectrum';
import ScoreChart from '../components/ScoreChart';
import ThreeCurvesChart from '../components/ThreeCurvesChart';
import AllocationPie from '../components/AllocationPie';
import MigrationLog from '../components/MigrationLog';
import MintCard from '../components/MintCard';
import { RefreshCw, Activity, Radio } from 'lucide-react';
import { SCORING_INTERVAL_MS } from '../../core/config';

export default function Home() {
  const { state, runScoring } = useStore();
  const { scores, balances, isScoring, lastScoredAt } = state;

  const balanceMap = new Map(balances.map((b) => [b.mintUrl, b.balance]));

  const lastScoredLabel = lastScoredAt
    ? new Date(lastScoredAt).toLocaleTimeString()
    : 'never';

  const onlineCount = scores.filter((s) => s.isOnline).length;
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
              <span className="text-[9px] text-[#8b949e] tracking-widest">
                LOAD LEVELER
              </span>
            </div>
          </div>

          {/* Status + Controls */}
          <div className="flex items-center gap-4">
            {/* Live polling indicator */}
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-[#8b949e] bg-[#21262d] rounded px-2.5 py-1 border border-[#30363d]">
              <Radio size={10} className="text-[#3fb950] animate-pulse" />
              <span>Polling every {pollingSeconds}s</span>
              <span className="text-[#30363d]">|</span>
              <span>{onlineCount}/{scores.length} online</span>
            </div>

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
            <button
              onClick={() => runScoring()}
              disabled={isScoring}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] hover:border-[#58a6ff]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={12} className={isScoring ? 'animate-spin' : ''} />
              Re-score
            </button>
          </div>
        </div>
      </header>

      {/* Main content — centered */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
            Mint Details ({scores.length} mints)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scores.map((score) => (
              <MintCard
                key={score.url}
                score={score}
                balance={balanceMap.get(score.url)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] font-mono text-[#8b949e]/40 py-6 border-t border-[#21262d]">
          L³ — MIT Bitcoin Hackathon 2026 — "Freedom for All"
        </footer>
      </main>
    </div>
  );
}
