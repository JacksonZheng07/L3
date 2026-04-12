import { useState } from 'react';
import { useStore } from '../../state/store';
import AlertPanel from '../components/AlertPanel';
import { AlertTriangle, ArrowRightLeft, TrendingDown, CheckCircle } from 'lucide-react';
import type { TrustAlert } from '../../state/types';

type AlertFilter = 'all' | 'critical' | 'score_drop' | 'migration';

const FILTER_CONFIG: Record<AlertFilter, { label: string; icon: typeof AlertTriangle; color: string }> = {
  all: { label: 'All', icon: AlertTriangle, color: '#58a6ff' },
  critical: { label: 'Critical', icon: AlertTriangle, color: '#f85149' },
  score_drop: { label: 'Score Drops', icon: TrendingDown, color: '#d29922' },
  migration: { label: 'Migrations', icon: ArrowRightLeft, color: '#3fb950' },
};

function matchesFilter(alert: TrustAlert, filter: AlertFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'critical') return alert.type === 'critical';
  if (filter === 'score_drop') return alert.type === 'score_drop';
  if (filter === 'migration') return alert.type === 'migration_suggested' || alert.type === 'migration_executed';
  return true;
}

export default function AlertsScreen() {
  const { state } = useStore();
  const [filter, setFilter] = useState<AlertFilter>('all');

  const alerts = state.alerts;
  const active = alerts.filter((a) => !a.dismissed);
  const dismissed = alerts.filter((a) => a.dismissed);
  const critical = alerts.filter((a) => a.type === 'critical' && !a.dismissed);
  const migrations = alerts.filter((a) => (a.type === 'migration_suggested' || a.type === 'migration_executed') && !a.dismissed);

  const statRows = [
    { label: 'Active', value: active.length, color: '#c9d1d9' },
    { label: 'Critical', value: critical.length, color: '#f85149' },
    { label: 'Migrations', value: migrations.length, color: '#58a6ff' },
    { label: 'Dismissed', value: dismissed.length, color: '#8b949e' },
  ];

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statRows.map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-[#21262d] bg-[#161b22] px-4 py-3 flex flex-col gap-1"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8b949e]">{label}</span>
            <span className="text-xl font-mono font-bold" style={{ color }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(FILTER_CONFIG) as AlertFilter[]).map((f) => {
          const { label, icon: Icon, color } = FILTER_CONFIG[f];
          const isActive = filter === f;
          const count = alerts.filter((a) => matchesFilter(a, f) && !a.dismissed).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-all"
              style={
                isActive
                  ? { color, background: `${color}12`, borderColor: `${color}40` }
                  : { color: '#8b949e', background: 'transparent', borderColor: '#21262d' }
              }
            >
              <Icon size={10} />
              {label}
              {count > 0 && (
                <span
                  className="text-[9px] px-1 rounded"
                  style={isActive ? { background: `${color}20` } : { background: '#21262d' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Alert panel */}
      <AlertPanel />

      {alerts.length === 0 && (
        <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-8 text-center">
          <CheckCircle size={24} className="text-[#3fb950] mx-auto mb-2" />
          <p className="text-xs font-mono text-[#8b949e]">
            All clear. Alerts will appear here when trust scores change significantly.
          </p>
        </div>
      )}
    </div>
  );
}
