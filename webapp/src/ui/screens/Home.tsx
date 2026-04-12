import { useState } from 'react';
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
import DemoModeSelector from '../components/DemoModeSelector';
import WalletInput from '../components/WalletInput';
import FedimintArchitecture from '../components/FedimintArchitecture';
import MathTheory from '../components/MathTheory';
import { RefreshCw, Activity, Radio, FlaskConical, Building2, ChevronDown, ChevronUp, BarChart3, Shield, Brain, Layers } from 'lucide-react';
import { SCORING_INTERVAL_MS } from '../../core/config';

type Section = 'demo' | 'math' | 'fedimint';

export default function Home() {
  const { state, runScoring, effectiveScores } = useStore();
  const { balances, isScoring, lastScoredAt, simulationActive } = state;
  const [expandedSection, setExpandedSection] = useState<Section | null>(null);

  const balanceMap = new Map(balances.map((b) => [b.mintUrl, b.balance]));

  const lastScoredLabel = lastScoredAt
    ? new Date(lastScoredAt).toLocaleTimeString()
    : 'never';

  const onlineCount = effectiveScores.filter((s) => s.isOnline).length;
  const pollingSeconds = SCORING_INTERVAL_MS / 1000;

  const toggleSection = (section: Section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

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
                BITCOIN PORTFOLIO RISK ENGINE
              </span>
              <span className="text-[9px] text-[#8b949e] tracking-widest flex items-center gap-1">
                <Building2 size={8} />
                INSTITUTIONAL-GRADE COUNTERPARTY MONITORING
              </span>
            </div>
          </div>

          {/* Status + Controls */}
          <div className="flex items-center gap-3">
            {/* Demo mode indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-[#8b949e] bg-[#21262d] rounded px-2 py-1 border border-[#30363d]">
              <span className={
                state.demoMode === 'mutinynet' ? 'text-[#a855f7]' :
                state.demoMode === 'testnet' ? 'text-[#d29922]' : 'text-[#3fb950]'
              }>
                {state.demoMode.toUpperCase()}
              </span>
            </div>

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
        {/* B2B Pitch Hero */}
        <div className="rounded-lg border border-[#58a6ff]/20 bg-gradient-to-r from-[#58a6ff]/5 via-[#a855f7]/5 to-[#3fb950]/5 p-6">
          <div className="text-center max-w-3xl mx-auto">
            <h1
              className="text-xl font-black tracking-tight mb-2"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                background: 'linear-gradient(135deg, #58a6ff 0%, #a855f7 50%, #22c55e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Bitcoin Portfolio Risk Management for Companies
            </h1>
            <p className="text-[11px] font-mono text-[#8b949e] leading-relaxed max-w-2xl mx-auto">
              Companies holding Bitcoin in custodial ecash need a system that monitors counterparty health,
              enforces diversification policy, and acts autonomously when a custodian degrades. L3 is that system.
            </p>
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#58a6ff]">
                <BarChart3 size={10} /> 9-Signal Scoring
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#3fb950]">
                <Shield size={10} /> 40% Max Exposure Cap
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#a855f7]">
                <Brain size={10} /> Bayesian Updates
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#d29922]">
                <Layers size={10} /> 3 Trust Layers
              </div>
            </div>
          </div>
        </div>

        {/* Wallet + Demo Mode + Simulation Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <WalletInput />
            <DemoModeSelector />
          </div>
          <div className="lg:col-span-3">
            <SimulationPanel />
          </div>
        </div>

        {/* Trust Response Mode + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AutomationControl />
          <AlertPanel />
        </div>

        {/* Trust Spectrum - full width */}
        <TrustSpectrum />

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <ScoreChart />
            <ThreeCurvesChart />
          </div>
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

        {/* Expandable Sections */}
        <div className="space-y-3">
          {/* Mathematical Framework */}
          <div className="rounded-lg border border-[#30363d] overflow-hidden">
            <button
              onClick={() => toggleSection('math')}
              className="w-full flex items-center justify-between p-4 bg-[#161b22] hover:bg-[#161b22]/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-[#a855f7]" />
                <span className="text-sm font-mono font-semibold text-[#c9d1d9]">
                  Mathematical Framework — The Theory Behind the Scores
                </span>
              </div>
              {expandedSection === 'math' ? (
                <ChevronUp size={16} className="text-[#8b949e]" />
              ) : (
                <ChevronDown size={16} className="text-[#8b949e]" />
              )}
            </button>
            {expandedSection === 'math' && (
              <div className="p-4 bg-[#0d1117]">
                <MathTheory />
              </div>
            )}
          </div>

          {/* Fedimint Architecture */}
          <div className="rounded-lg border border-[#30363d] overflow-hidden">
            <button
              onClick={() => toggleSection('fedimint')}
              className="w-full flex items-center justify-between p-4 bg-[#161b22] hover:bg-[#161b22]/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#3fb950]" />
                <span className="text-sm font-mono font-semibold text-[#c9d1d9]">
                  Fedimint Federations — Multi-Guardian Architecture
                </span>
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#3fb950]/20 text-[#3fb950] border border-[#3fb950]/30">
                  +15 TRUST BONUS
                </span>
              </div>
              {expandedSection === 'fedimint' ? (
                <ChevronUp size={16} className="text-[#8b949e]" />
              ) : (
                <ChevronDown size={16} className="text-[#8b949e]" />
              )}
            </button>
            {expandedSection === 'fedimint' && (
              <div className="p-4 bg-[#0d1117]">
                <FedimintArchitecture />
              </div>
            )}
          </div>
        </div>

        {/* Enterprise Pitch Footer */}
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-6">
          <h4 className="text-xs font-mono font-semibold text-[#8b949e] uppercase tracking-widest mb-3 text-center">
            Why L3 for Enterprise Bitcoin Treasury
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-4xl mx-auto">
            <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
              <div className="text-[11px] font-mono font-semibold text-[#58a6ff] mb-1">On-Chain Intelligence</div>
              <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                Allium Labs API: holder concentration, wash trading detection, deployer wallet profiles, entity labels.
                60% weight from on-chain data that can't be faked.
              </div>
            </div>
            <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
              <div className="text-[11px] font-mono font-semibold text-[#3fb950] mb-1">Mathematically Rigorous</div>
              <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                Weighted composite scoring with Bayesian updates, portfolio VaR calculation,
                Markowitz-inspired allocation with 40% exposure cap and hysteresis migration.
              </div>
            </div>
            <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
              <div className="text-[11px] font-mono font-semibold text-[#a855f7] mb-1">Configurable Trust Layers</div>
              <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                Dashboard, webhook, or full automation. Supports Cashu (single operator) and
                Fedimint (federated) custodians. Your treasury policy, L3's execution.
              </div>
            </div>
          </div>

          {/* Roadmap */}
          <div className="mt-4 pt-4 border-t border-[#21262d]">
            <div className="text-[9px] font-mono text-[#8b949e] uppercase tracking-widest text-center mb-3">
              Roadmap
            </div>
            <div className="flex items-center justify-center gap-2 text-[9px] font-mono">
              <span className="px-2 py-1 rounded bg-[#3fb950]/20 text-[#3fb950] border border-[#3fb950]/30">
                Phase 1: Cashu + Live Allium
              </span>
              <span className="text-[#8b949e]">{'>'}</span>
              <span className="px-2 py-1 rounded bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/30">
                Phase 2: Fedimint SDK + Live Allium
              </span>
              <span className="text-[#8b949e]">{'>'}</span>
              <span className="px-2 py-1 rounded bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30">
                Phase 3: Ark Self-Custody
              </span>
              <span className="text-[#8b949e]">{'>'}</span>
              <span className="px-2 py-1 rounded bg-[#d29922]/20 text-[#d29922] border border-[#d29922]/30">
                Phase 4: Enterprise API
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] font-mono text-[#8b949e]/40 py-6 border-t border-[#21262d]">
          L3 — Bitcoin Portfolio Risk Engine — MIT Bitcoin Hackathon 2026 — Institutional-Grade Counterparty Monitoring
        </footer>
      </main>
    </div>
  );
}
