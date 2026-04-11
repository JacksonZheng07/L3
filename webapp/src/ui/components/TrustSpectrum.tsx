import { useStore } from '../../state/store';
import { Zap } from 'lucide-react';

const gradeColor = (grade: 'safe' | 'warning' | 'critical') =>
  grade === 'safe' ? '#3fb950' : grade === 'warning' ? '#d29922' : '#f85149';

export default function TrustSpectrum() {
  const { state } = useStore();
  const { scores, totalBalance } = state;

  return (
    <div className="w-full rounded-lg border border-[#30363d] bg-[#161b22] p-6">
      {/* Total balance */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <Zap size={20} className="text-[#d29922]" />
        <span className="text-3xl font-bold font-mono text-[#c9d1d9]">
          {totalBalance.toLocaleString()} sats
        </span>
      </div>

      {/* Spectrum label */}
      <div className="text-xs text-[#8b949e] font-mono mb-2 text-center tracking-widest uppercase">
        Custody Spectrum
      </div>

      {/* The bar */}
      <div className="relative h-16 rounded-lg overflow-hidden flex">
        {/* Cashu zone — 50% */}
        <div
          className="relative flex-[5] rounded-l-lg"
          style={{
            background: 'linear-gradient(90deg, #3d2200 0%, #523000 50%, #6b4000 100%)',
          }}
        >
          <div className="absolute top-1 left-3 text-[10px] font-mono text-[#d29922] font-semibold tracking-wide uppercase">
            Cashu Ecash Mints
          </div>

          {/* Mint dots positioned by score */}
          <div className="absolute bottom-2 left-0 right-0 h-8 px-4">
            {scores.map((mint) => {
              const leftPct = Math.max(5, Math.min(95, mint.compositeScore));
              const size = Math.max(10, Math.min(28, mint.allocationPct * 0.8 + 8));
              return (
                <div
                  key={mint.url}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/30 transition-all duration-500"
                  style={{
                    left: `${leftPct}%`,
                    top: '50%',
                    width: size,
                    height: size,
                    backgroundColor: gradeColor(mint.grade),
                    boxShadow: `0 0 ${size / 2}px ${gradeColor(mint.grade)}66`,
                  }}
                  title={`${mint.name}: ${mint.compositeScore.toFixed(0)} (${mint.allocationPct.toFixed(1)}%)`}
                />
              );
            })}
          </div>
        </div>

        {/* Ark zone — 25% */}
        <div
          className="relative flex-[2.5] opacity-50"
          style={{
            background: 'linear-gradient(90deg, #0c2d48 0%, #133a5c 100%)',
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] font-mono text-[#58a6ff] font-semibold tracking-wide">
              Ark Self-Custody
            </span>
            <span className="text-[8px] font-mono bg-[#58a6ff]/20 text-[#58a6ff] px-2 py-0.5 rounded-full border border-[#58a6ff]/30">
              Coming Soon
            </span>
          </div>
        </div>

        {/* On-chain zone — 25% */}
        <div
          className="relative flex-[2.5] rounded-r-lg opacity-40"
          style={{
            background: 'linear-gradient(90deg, #0b3d1a 0%, #1a5c2e 100%)',
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] font-mono text-[#3fb950] font-semibold tracking-wide">
              On-Chain Sovereignty
            </span>
            <span className="text-[8px] font-mono bg-[#3fb950]/20 text-[#3fb950] px-2 py-0.5 rounded-full border border-[#3fb950]/30">
              Future
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-[10px] font-mono text-[#8b949e]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#3fb950]" /> Safe
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#d29922]" /> Warning
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f85149]" /> Critical
        </span>
        <span className="text-[#8b949e]/60">Dot size = allocation %</span>
      </div>
    </div>
  );
}
