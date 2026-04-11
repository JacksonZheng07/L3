import { useAppState } from '../../state/store';
import { config } from '../../core/config';

export function MigrationLog() {
  const state = useAppState();
  const migrations = state.migrations.slice(0, config.ui.maxMigrationLogDisplay);

  if (migrations.length === 0) {
    return (
      <div className="glass rounded-2xl px-4 py-8 text-center">
        <p className="text-[13px] text-white/20">No migrations yet</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
      {migrations.map(m => {
        const statusConfig: Record<string, { icon: string; color: string }> = {
          pending: { icon: '\u25CB', color: 'text-yellow-400' },
          melting: { icon: '\u25D4', color: 'text-orange-400' },
          minting: { icon: '\u25D4', color: 'text-blue-400' },
          success: { icon: '\u2713', color: 'text-emerald-400' },
          failed: { icon: '\u2717', color: 'text-red-400' },
        };

        const s = statusConfig[m.status] ?? statusConfig.pending;

        return (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`text-sm ${s.color}`}>{s.icon}</span>
              <div>
                <span className="text-[13px] font-medium text-white/80">
                  {m.amount.toLocaleString()} sats
                </span>
                <span className="text-[11px] text-white/20 ml-2">migrated</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-medium ${s.color}`}>
                {m.status}
              </span>
              <span className="text-[11px] text-white/15 tabular-nums">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
