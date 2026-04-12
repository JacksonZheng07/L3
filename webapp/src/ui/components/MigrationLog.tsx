import { useStore } from '../../state/store';
import { relativeTime } from '../../lib/formatters';
import { ArrowRight, Clock } from 'lucide-react';

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: '#d29922', bg: 'bg-[#d29922]/10', label: 'Pending' },
  in_progress: { color: '#58a6ff', bg: 'bg-[#58a6ff]/10', label: 'In Progress' },
  completed: { color: '#3fb950', bg: 'bg-[#3fb950]/10', label: 'Completed' },
  failed: { color: '#f85149', bg: 'bg-[#f85149]/10', label: 'Failed' },
};

export default function MigrationLog() {
  const { state } = useStore();
  const { migrations } = state;

  if (migrations.length === 0) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
        <h3 className="text-sm font-mono font-semibold text-[#c9d1d9] mb-3">Migration Log</h3>
        <div className="text-xs font-mono text-[#8b949e] text-center py-6">
          No migrations yet. L3 will auto-migrate when risk thresholds are crossed.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h3 className="text-sm font-mono font-semibold text-[#c9d1d9] mb-3">Migration Log</h3>
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {migrations.map((event) => {
          const cfg = statusConfig[event.status];
          return (
            <div
              key={event.id}
              className="relative pl-4 border-l-2 border-[#30363d] pb-2"
            >
              {/* Timeline dot */}
              <div
                className="absolute left-[-5px] top-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />

              {/* From -> To */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#c9d1d9] mb-1">
                <span className="truncate max-w-[120px]">{event.fromMint}</span>
                <ArrowRight size={10} className="text-[#8b949e] shrink-0" />
                <span className="truncate max-w-[120px]">{event.toMint}</span>
              </div>

              {/* Amount + reason */}
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#8b949e] mb-1">
                <span className="text-[#c9d1d9] font-semibold">{event.amount.toLocaleString()} sats</span>
                <span className="text-[#8b949e]/70">{event.reason}</span>
              </div>

              {/* Status + time */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${cfg.bg}`}
                  style={{ color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <span className="flex items-center gap-1 text-[9px] font-mono text-[#8b949e]/60">
                  <Clock size={8} /> {relativeTime(event.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
