import { useAppState, getMintList } from '../../state/store';

export function TrustSpectrum() {
  const state = useAppState();
  const mints = getMintList(state);
  const totalBalance = mints.reduce((sum, m) => sum + m.balance, 0);

  // Calculate Cashu zone fill based on where funds are
  const cashuBalance = totalBalance;
  const arkBalance = 0;
  const onChainBalance = 0;

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs font-semibold text-white/40 uppercase tracking-[0.15em]">
          Trust Spectrum
        </span>
        <span className="text-xs text-white/20">
          {totalBalance.toLocaleString()} sats
        </span>
      </div>

      {/* Spectrum Bar */}
      <div className="relative">
        <div className="flex h-12 rounded-xl overflow-hidden bg-white/[0.02]">
          {/* Cashu Zone */}
          <div className="flex-[3] relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20" />
            <div className="relative flex items-center gap-2">
              {mints.map(mint => {
                const dotColor =
                  mint.trustScore.grade === 'safe' ? 'bg-emerald-400' :
                  mint.trustScore.grade === 'warning' ? 'bg-yellow-400' :
                  'bg-red-400';
                const dotGlow =
                  mint.trustScore.grade === 'safe' ? 'status-dot-green' :
                  mint.trustScore.grade === 'warning' ? 'status-dot-yellow' :
                  'status-dot-red';

                return (
                  <div key={mint.url} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/20">
                    <div className={`w-2 h-2 rounded-full ${dotColor} status-dot ${dotGlow}`} />
                    <span className="text-[11px] font-medium text-white/70">
                      {mint.name}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {mint.balance}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-white/[0.06]" />

          {/* Ark Zone */}
          <div className="flex-[2] relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/[0.05]" />
            <div className="relative text-center">
              <span className="text-[10px] font-medium text-blue-400/40">Ark</span>
              <div className="text-[9px] text-white/15">Coming Soon</div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-white/[0.06]" />

          {/* On-Chain Zone */}
          <div className="flex-[2] relative flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-500/[0.04]" />
            <div className="relative text-center">
              <span className="text-[10px] font-medium text-emerald-400/40">On-Chain</span>
              <div className="text-[9px] text-white/15">Sovereignty</div>
            </div>
          </div>
        </div>

        {/* Zone Labels */}
        <div className="flex mt-2 text-[10px] text-white/20">
          <div className="flex-[3] text-center">Custodial</div>
          <div className="flex-[2] text-center">Semi-trust</div>
          <div className="flex-[2] text-center">Trustless</div>
        </div>
      </div>

      {/* Prism gradient accent line */}
      <div className="prism-line animate-prism" />
    </div>
  );
}
