import { useAppState } from '../../state/store';
import { config } from '../../core/config';

export function TxHistory() {
  const state = useAppState();
  const txs = state.transactions.slice(0, config.ui.maxTxHistoryDisplay);

  if (txs.length === 0) {
    return (
      <div className="glass rounded-2xl px-4 py-8 text-center">
        <div className="text-white/10 text-2xl mb-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto opacity-30">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-[13px] text-white/20">No transactions yet</p>
        <p className="text-[11px] text-white/10 mt-1">Receive some sats to get started</p>
      </div>
    );
  }

  const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
    receive: { icon: '\u2193', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    send: { icon: '\u2191', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    migration_out: { icon: '\u21C4', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    migration_in: { icon: '\u21C4', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  };

  return (
    <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
      {txs.map(tx => {
        const t = typeConfig[tx.type] ?? typeConfig.receive;
        const isIncoming = tx.type === 'receive' || tx.type === 'migration_in';

        return (
          <div key={tx.id} className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={`w-8 h-8 rounded-xl ${t.bg} flex items-center justify-center`}>
                <span className={`text-sm ${t.color}`}>{t.icon}</span>
              </div>
              {/* Details */}
              <div>
                <div className="text-[13px] font-medium text-white/80 capitalize">{tx.type.replace('_', ' ')}</div>
                <div className="text-[11px] text-white/20 tabular-nums">
                  {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Amount + Status */}
            <div className="text-right">
              <div className={`text-[13px] font-semibold tabular-nums ${isIncoming ? 'text-emerald-400' : 'text-white/80'}`}>
                {isIncoming ? '+' : '-'}{tx.amount.toLocaleString()} sats
              </div>
              <div className={`text-[10px] font-medium ${
                tx.status === 'success' ? 'text-emerald-400/60' :
                tx.status === 'failed' ? 'text-red-400/60' :
                'text-yellow-400/60'
              }`}>
                {tx.status}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
