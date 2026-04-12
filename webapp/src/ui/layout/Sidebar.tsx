import { useStore } from '../../state/store';
import type { AppView } from '../../state/types';
import { COLORS } from '../../lib/theme';
import {
  BarChart3,
  Cpu,
  Bell,
  FlaskConical,
  ArrowRightLeft,
  Wallet,
  Monitor,
  Webhook,
  Bot,
  Circle,
} from 'lucide-react';

interface NavItem {
  view: AppView;
  label: string;
  icon: typeof BarChart3;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard',   label: 'Dashboard',  icon: BarChart3 },
  { view: 'mints',       label: 'Mints',       icon: Cpu },
  { view: 'alerts',      label: 'Alerts',      icon: Bell },
  { view: 'simulation',  label: 'Simulation',  icon: FlaskConical },
  { view: 'migrations',  label: 'Migrations',  icon: ArrowRightLeft },
  { view: 'wallet',      label: 'Wallet',      icon: Wallet },
];

const AUTOMATION_ICONS = { manual: Monitor, alert: Webhook, auto: Bot } as const;
const AUTOMATION_COLORS = { manual: '#58a6ff', alert: '#d29922', auto: '#3fb950' } as const;
const AUTOMATION_LABELS = { manual: 'Dashboard Only', alert: 'Webhook / Alert', auto: 'Full Automation' } as const;

export default function Sidebar() {
  const { state, setView, dispatch } = useStore();
  const { currentView, automationMode, alerts, scores, isScoring, simulationActive, lastScoredAt } = state;

  const unreadAlerts = alerts.filter((a) => !a.dismissed).length;
  const onlineMints = scores.filter((s) => s.isOnline).length;
  const totalMints = scores.length;

  const lastScored = lastScoredAt
    ? new Date(lastScoredAt).toLocaleTimeString()
    : 'never';

  return (
    <aside
      className="flex flex-col h-screen border-r border-[#21262d] select-none"
      style={{ background: COLORS.sidebar, width: '220px', flexShrink: 0 }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #58a6ff 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            L³
          </span>
          <div>
            <div className="text-[11px] font-mono font-bold text-[#c9d1d9] leading-none">
              L3 Risk Engine
            </div>
            <div className="text-[9px] font-mono text-[#8b949e] leading-none mt-0.5">
              v0.1 · MIT Bitcoin Hackathon
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/50 px-2 mb-2">
          Navigation
        </div>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
            const isActive = currentView === view;
            const badge = view === 'alerts' && unreadAlerts > 0 ? unreadAlerts : null;
            return (
              <li key={view}>
                <button
                  onClick={() => setView(view)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150 group relative"
                  style={
                    isActive
                      ? {
                          background: 'rgba(88,166,255,0.08)',
                          borderLeft: '2px solid #58a6ff',
                          paddingLeft: '10px',
                        }
                      : { borderLeft: '2px solid transparent', paddingLeft: '10px' }
                  }
                >
                  <Icon
                    size={15}
                    style={{ color: isActive ? '#58a6ff' : '#8b949e' }}
                    className="shrink-0 transition-colors group-hover:text-[#c9d1d9]"
                  />
                  <span
                    className="text-xs font-mono transition-colors"
                    style={{ color: isActive ? '#c9d1d9' : '#8b949e' }}
                  >
                    {label}
                  </span>
                  {badge && (
                    <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#f85149]/20 text-[#f85149] font-bold">
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Automation mode section */}
        <div className="mt-6">
          <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/50 px-2 mb-2">
            Automation Mode
          </div>
          <div className="space-y-0.5">
            {(['manual', 'alert', 'auto'] as const).map((mode) => {
              const Icon = AUTOMATION_ICONS[mode];
              const color = AUTOMATION_COLORS[mode];
              const isActive = automationMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => dispatch({ type: 'SET_AUTOMATION_MODE', mode })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150"
                  style={
                    isActive
                      ? { background: `${color}12`, border: `1px solid ${color}30` }
                      : { border: '1px solid transparent' }
                  }
                >
                  <Icon size={13} style={{ color: isActive ? color : '#8b949e' }} className="shrink-0" />
                  <span
                    className="text-[10px] font-mono truncate"
                    style={{ color: isActive ? color : '#8b949e' }}
                  >
                    {AUTOMATION_LABELS[mode]}
                  </span>
                  {isActive && (
                    <Circle size={5} className="ml-auto shrink-0 fill-current" style={{ color }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* System status footer */}
      <div className="px-4 py-4 border-t border-[#21262d] space-y-2">
        <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/50 mb-2">
          System
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: isScoring ? '#d29922' : '#3fb950', animation: isScoring ? 'pulse 1s infinite' : 'none' }}
          />
          <span className="text-[#8b949e]">
            {isScoring ? 'Scoring…' : `Last: ${lastScored}`}
          </span>
        </div>

        {totalMints > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#8b949e]">
            <Cpu size={10} className="shrink-0" />
            <span>{onlineMints}/{totalMints} mints online</span>
          </div>
        )}

        {simulationActive && (
          <div className="flex items-center gap-2 text-[9px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30 animate-pulse">
              SIM ACTIVE
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
