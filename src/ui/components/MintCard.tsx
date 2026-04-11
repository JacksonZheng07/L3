import type { MintState } from '../../state/types';

function timeAgo(ts: number): string {
  if (ts === 0) return 'never';
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export function MintCard({ mint }: { mint: MintState }) {
  const gradeConfig = {
    safe: {
      dot: 'bg-emerald-400',
      glow: 'status-dot-green',
      border: 'border-emerald-500/10 hover:border-emerald-500/20',
      badge: 'bg-emerald-500/10 text-emerald-400',
      label: 'Healthy',
    },
    warning: {
      dot: 'bg-yellow-400',
      glow: 'status-dot-yellow',
      border: 'border-yellow-500/10 hover:border-yellow-500/20',
      badge: 'bg-yellow-500/10 text-yellow-400',
      label: 'Warning',
    },
    critical: {
      dot: 'bg-red-400',
      glow: 'status-dot-red',
      border: 'border-red-500/10 hover:border-red-500/20',
      badge: 'bg-red-500/10 text-red-400',
      label: 'Critical',
    },
  };

  const grade = gradeConfig[mint.trustScore.grade];

  return (
    <div className={`glass glass-hover rounded-2xl p-4 transition-all duration-200 ${grade.border}`}>
      <div className="flex items-center justify-between">
        {/* Left: status + name */}
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${grade.dot} status-dot ${grade.glow}`} />
          <div>
            <h3 className="font-display text-sm font-semibold text-white/90">{mint.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${grade.badge}`}>
                {grade.label}
              </span>
              <span className="text-[10px] text-white/20">
                checked {timeAgo(mint.trustScore.lastChecked)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: balance + trust score */}
        <div className="text-right">
          <div className="font-display text-lg font-bold text-white">
            {mint.balance.toLocaleString()}
            <span className="text-xs font-normal text-white/25 ml-1">sats</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <div className="w-12 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  mint.trustScore.score >= 75 ? 'bg-emerald-400' :
                  mint.trustScore.score >= 50 ? 'bg-yellow-400' :
                  'bg-red-400'
                }`}
                style={{ width: `${mint.trustScore.score}%` }}
              />
            </div>
            <span className="text-[10px] text-white/30 font-medium tabular-nums">
              {mint.trustScore.score}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
