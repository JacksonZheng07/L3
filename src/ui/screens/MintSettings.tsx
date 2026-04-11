import { useAppState, getMintList } from '../../state/store';
import { explainScore } from '../../core/trustEngine';
import { config } from '../../core/config';

interface Props {
  onBack: () => void;
}

export function MintSettings({ onBack }: Props) {
  const state = useAppState();
  const mints = getMintList(state);

  const signalLabels: Record<string, string> = {
    availability: 'Availability',
    latency: 'Latency',
    keysetStable: 'Keyset Stability',
    txSuccessRate: 'Tx Success Rate',
    versionCurrent: 'Version',
    operatorInfo: 'Operator Info',
  };

  const weights = config.trust.weights;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white noise">
      <div className="relative max-w-lg mx-auto px-5 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl glass glass-hover flex items-center justify-center transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50"/>
            </svg>
          </button>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Mint Details</h1>
            <p className="text-[11px] text-white/25 mt-0.5">Trust signal breakdown</p>
          </div>
        </div>

        <div className="space-y-5 stagger-children">
          {mints.map(mint => {
            const explanation = explainScore(mint.trustScore);
            const signals = mint.trustScore.signals;

            const gradeColor =
              mint.trustScore.grade === 'safe' ? 'text-emerald-400' :
              mint.trustScore.grade === 'warning' ? 'text-yellow-400' :
              'text-red-400';

            const gradeBg =
              mint.trustScore.grade === 'safe' ? 'bg-emerald-500/10 border-emerald-500/15' :
              mint.trustScore.grade === 'warning' ? 'bg-yellow-500/10 border-yellow-500/15' :
              'bg-red-500/10 border-red-500/15';

            return (
              <div key={mint.url} className="glass rounded-2xl p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h2 className="font-display text-base font-bold text-white/90">{mint.name}</h2>
                    <p className="text-[11px] text-white/20 font-mono truncate max-w-[240px]">{mint.url}</p>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 text-center ${gradeBg}`}>
                    <div className={`font-display text-2xl font-bold ${gradeColor}`}>
                      {mint.trustScore.score}
                    </div>
                    <div className="text-[10px] text-white/25 mt-0.5">/ 100</div>
                  </div>
                </div>

                {/* Explanation */}
                <p className="text-[13px] text-white/35 leading-relaxed">{explanation}</p>

                {/* Signal Breakdown */}
                <div className="space-y-3">
                  <h3 className="font-display text-[11px] font-semibold text-white/25 uppercase tracking-[0.15em]">
                    Signal Breakdown
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(signals).map(([key, value]) => {
                      const weight = weights[key as keyof typeof weights];
                      const contribution = Math.round(value * weight * 100);
                      const barColor =
                        value >= 0.8 ? 'bg-emerald-400' :
                        value >= 0.5 ? 'bg-yellow-400' :
                        'bg-red-400';

                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] text-white/40">{signalLabels[key]}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-white/50 font-medium tabular-nums">
                                {Math.round(value * 100)}%
                              </span>
                              <span className="text-[10px] text-white/20 tabular-nums w-8 text-right">
                                +{contribution}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all duration-700`}
                              style={{ width: `${value * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.04]">
                  <div className="text-center">
                    <div className="text-[10px] text-white/20 mb-1">Balance</div>
                    <div className="font-display text-sm font-semibold text-white/70">
                      {mint.balance.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-white/15">sats</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-white/20 mb-1">Tx Success</div>
                    <div className="font-display text-sm font-semibold text-white/70">
                      {mint.txTotal > 0
                        ? `${Math.round((mint.txSuccess / mint.txTotal) * 100)}%`
                        : 'N/A'}
                    </div>
                    <div className="text-[10px] text-white/15">
                      {mint.txTotal > 0 ? `${mint.txSuccess}/${mint.txTotal}` : 'no data'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-white/20 mb-1">Keysets</div>
                    <div className={`font-display text-sm font-semibold ${
                      mint.cachedKeysets.length > 0 ? 'text-emerald-400/70' : 'text-white/30'
                    }`}>
                      {mint.cachedKeysets.length > 0 ? 'Stable' : 'Pending'}
                    </div>
                    <div className="text-[10px] text-white/15">
                      {mint.cachedKeysets.length || 0} cached
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
