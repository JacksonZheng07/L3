import { useWallet } from '../context/WalletContext';

export function TrustSpectrum() {
  const { mints, totalBalance } = useWallet();

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Cashu (Mint Trust)</span>
        <span className="text-gray-600">Ark (Self-Custody)</span>
        <span className="text-gray-600">On-Chain (Sovereign)</span>
      </div>

      {/* Gradient bar */}
      <div className="relative h-10 rounded-xl overflow-hidden" style={{
        background: 'linear-gradient(to right, #f59e0b 0%, #f59e0b 33%, #3b82f6 33%, #3b82f6 66%, #22c55e 66%, #22c55e 100%)',
      }}>
        {/* Overlay to gray out unused zones */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(to right, transparent 0%, transparent 33%, rgba(0,0,0,0.7) 33%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        {/* Per-mint segments */}
        {totalBalance > 0 && mints.map((mint, i) => {
          if (mint.balance === 0) return null;
          const pct = (mint.balance / totalBalance) * 33; // within Cashu zone
          const offset = mints.slice(0, i).reduce((s, m) => s + (m.balance / totalBalance) * 33, 0);
          return (
            <div
              key={mint.url}
              className="absolute top-0 h-full flex items-center justify-center text-xs font-bold text-black/80 transition-all duration-500"
              style={{
                left: `${offset}%`,
                width: `${pct}%`,
                backgroundColor: i === 0 ? 'rgba(251,191,36,0.9)' : 'rgba(245,158,11,0.9)',
              }}
            >
              {mint.balance > 0 && (
                <span className="truncate px-1">
                  {mint.alias}: {mint.balance.toLocaleString()}
                </span>
              )}
            </div>
          );
        })}

        {/* Zone labels */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 flex items-center justify-center">
            {totalBalance === 0 && (
              <span className="text-xs font-medium text-black/50">Cashu</span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs font-medium text-white/30">Ark</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs font-medium text-white/30">On-Chain</span>
          </div>
        </div>
      </div>

      {/* Per-mint breakdown */}
      {mints.length > 0 && (
        <div className="flex gap-3">
          {mints.map((mint) => (
            <div
              key={mint.url}
              className="flex-1 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-300">{mint.alias}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor:
                      mint.trustScore.totalScore >= 80
                        ? 'rgba(34,197,94,0.15)'
                        : mint.trustScore.totalScore >= 50
                          ? 'rgba(234,179,8,0.15)'
                          : 'rgba(239,68,68,0.15)',
                    color:
                      mint.trustScore.totalScore >= 80
                        ? '#22c55e'
                        : mint.trustScore.totalScore >= 50
                          ? '#eab308'
                          : '#ef4444',
                  }}
                >
                  {mint.trustScore.totalScore}/100
                </span>
              </div>
              <p className="text-lg font-bold text-white">
                {mint.balance.toLocaleString()} <span className="text-sm font-normal text-gray-400">sats</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
