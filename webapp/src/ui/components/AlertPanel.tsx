import { useStore } from '../../state/store';
import { relativeTime } from '../../lib/formatters';
import { AlertTriangle, TrendingDown, ArrowRightLeft, CheckCircle, X, Bell } from 'lucide-react';

const typeConfig: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  critical: { icon: AlertTriangle, color: '#f85149', bg: 'bg-[#f85149]/10' },
  score_drop: { icon: TrendingDown, color: '#d29922', bg: 'bg-[#d29922]/10' },
  migration_suggested: { icon: ArrowRightLeft, color: '#58a6ff', bg: 'bg-[#58a6ff]/10' },
  migration_executed: { icon: CheckCircle, color: '#3fb950', bg: 'bg-[#3fb950]/10' },
  recovery: { icon: CheckCircle, color: '#3fb950', bg: 'bg-[#3fb950]/10' },
};

export default function AlertPanel() {
  const { state, dispatch, approveMigration } = useStore();
  const activeAlerts = state.alerts.filter(a => !a.dismissed);
  const dismissedAlerts = state.alerts.filter(a => a.dismissed);

  if (state.alerts.length === 0) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} className="text-[#8b949e]" />
          <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">Trust Alerts</h3>
        </div>
        <div className="text-xs font-mono text-[#8b949e] text-center py-6">
          No alerts yet. Alerts appear when trust scores change significantly.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[#d29922]" />
          <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
            Trust Alerts
          </h3>
          {activeAlerts.length > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#f85149]/20 text-[#f85149] font-bold">
              {activeAlerts.length}
            </span>
          )}
        </div>
        {state.alerts.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'CLEAR_ALERTS' })}
            className="text-[9px] font-mono text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
        {activeAlerts.map(alert => {
          const config = typeConfig[alert.type] ?? typeConfig.score_drop;
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={`relative flex items-start gap-3 rounded-lg border border-[#30363d] p-3 ${config.bg} animate-fade-in`}
            >
              <Icon size={14} style={{ color: config.color }} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-semibold text-[#c9d1d9]">
                    {alert.mintName}
                  </span>
                  <span className="text-[9px] font-mono text-[#8b949e]">
                    {relativeTime(alert.timestamp)}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-[#8b949e] leading-relaxed">
                  {alert.message}
                </p>

                {/* Action buttons for pending alerts in alert mode */}
                {alert.actionTaken === 'pending' && alert.type === 'migration_suggested' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => approveMigration(alert.id, alert.mintName, alert.score)}
                      className="text-[9px] font-mono px-2 py-1 rounded bg-[#3fb950]/20 text-[#3fb950] border border-[#3fb950]/30 hover:bg-[#3fb950]/30 transition-colors"
                    >
                      Approve Migration
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'SET_ALERT_ACTION', id: alert.id, action: 'ignored' })}
                      className="text-[9px] font-mono px-2 py-1 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d] hover:bg-[#30363d] transition-colors"
                    >
                      Dismiss Risk
                    </button>
                  </div>
                )}

                {alert.actionTaken === 'migrated' && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono text-[#3fb950]">
                    <CheckCircle size={8} /> Migrated
                  </span>
                )}
                {alert.actionTaken === 'ignored' && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono text-[#8b949e]">
                    Risk acknowledged
                  </span>
                )}
              </div>

              <button
                onClick={() => dispatch({ type: 'DISMISS_ALERT', id: alert.id })}
                className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {dismissedAlerts.length > 0 && (
          <details className="mt-3">
            <summary className="text-[9px] font-mono text-[#8b949e] cursor-pointer hover:text-[#c9d1d9]">
              {dismissedAlerts.length} dismissed alert(s)
            </summary>
            <div className="space-y-1 mt-2 opacity-50">
              {dismissedAlerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="text-[9px] font-mono text-[#8b949e] pl-4 border-l border-[#21262d]">
                  {alert.message}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
