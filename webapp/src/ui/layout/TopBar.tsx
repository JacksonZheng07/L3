import { useState } from 'react';
import { useStore } from '../../state/store';
import type { AppView } from '../../state/types';
import { Bell, RefreshCw, Search } from 'lucide-react';

const VIEW_LABELS: Record<AppView, string> = {
  dashboard: 'Dashboard',
  mints: 'Mints',
  alerts: 'Alerts',
  simulation: 'Simulation',
  migrations: 'Migrations',
  wallet: 'Wallet',
};

const DEMO_MODE_STYLE = {
  testnet: { label: 'TESTNET', color: '#d29922', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.3)' },
  mainnet: { label: 'MAINNET', color: '#3fb950', bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.3)' },
} as const;

interface TopBarProps {
  onSearchChange?: (query: string) => void;
}

export default function TopBar({ onSearchChange }: TopBarProps) {
  const { state, runScoring, setView } = useStore();
  const { currentView, alerts, demoMode, isScoring, simulationActive } = state;

  const [searchValue, setSearchValue] = useState('');
  const unreadCount = alerts.filter((a) => !a.dismissed).length;
  const demoStyle = DEMO_MODE_STYLE[demoMode];

  function handleSearch(value: string) {
    setSearchValue(value);
    onSearchChange?.(value);
  }

  return (
    <header
      className="flex items-center gap-4 px-6 shrink-0 border-b border-[#21262d]"
      style={{ height: '56px', background: '#0d1117' }}
    >
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-[#8b949e] shrink-0">
        <span className="text-[#8b949e]/50">L3</span>
        <span className="mx-1.5 text-[#8b949e]/30">/</span>
        <span className="text-[#c9d1d9] font-semibold">{VIEW_LABELS[currentView]}</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]/50 pointer-events-none" />
        <input
          type="text"
          placeholder="Search mints…"
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full text-xs font-mono pl-8 pr-3 py-1.5 rounded-lg border border-[#21262d] bg-[#161b22] text-[#c9d1d9] placeholder-[#8b949e]/40 focus:outline-none focus:border-[#58a6ff]/40 transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Simulation badge */}
        {simulationActive && (
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30 animate-pulse">
            SIM
          </span>
        )}

        {/* Demo mode pill */}
        <span
          className="text-[9px] font-mono px-2 py-0.5 rounded font-bold cursor-default"
          style={{ color: demoStyle.color, background: demoStyle.bg, border: `1px solid ${demoStyle.border}` }}
        >
          {demoStyle.label}
        </span>

        {/* Notification bell */}
        <button
          onClick={() => setView('alerts')}
          className="relative p-1.5 rounded-lg hover:bg-[#21262d] transition-colors"
          title={`${unreadCount} alerts`}
        >
          <Bell size={15} className="text-[#8b949e]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-mono font-bold rounded-full bg-[#f85149] text-white px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Re-score button */}
        <button
          onClick={runScoring}
          disabled={isScoring}
          className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg border border-[#30363d] bg-[#161b22] text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <RefreshCw size={11} className={isScoring ? 'animate-spin' : ''} />
          {isScoring ? 'Scoring…' : 'Re-score'}
        </button>
      </div>
    </header>
  );
}
