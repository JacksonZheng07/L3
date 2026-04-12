import { useStore } from '../../state/store';
import type { DemoMode } from '../../state/types';
import { FlaskConical, TestTube, Coins, QrCode } from 'lucide-react';

const demoModes: {
  mode: DemoMode;
  label: string;
  description: string;
  icon: typeof FlaskConical;
  color: string;
  badge?: string;
}[] = [
  {
    mode: 'mock',
    label: 'Mock Data',
    description: 'Hardcoded simulation data. No real transactions. Best for demos and pitch presentations.',
    icon: FlaskConical,
    color: '#a855f7',
    badge: 'RECOMMENDED FOR DEMO',
  },
  {
    mode: 'testnet',
    label: 'Mutinynet Testnet',
    description: 'Live testnet using Mutinynet signet. Real Lightning transactions with penny amounts. QR code for live demo.',
    icon: TestTube,
    color: '#d29922',
    badge: 'LIVE DEMO',
  },
  {
    mode: 'mainnet',
    label: 'Mainnet',
    description: 'Real Bitcoin mainnet with penny amounts (<100 sats). Production-grade for institutional evaluation.',
    icon: Coins,
    color: '#3fb950',
    badge: 'PRODUCTION',
  },
];

export default function DemoModeSelector() {
  const { state, dispatch } = useStore();

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
          Demo Environment
        </h3>
        {state.demoMode === 'testnet' && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#d29922] bg-[#d29922]/10 rounded px-2 py-1 border border-[#d29922]/30">
            <QrCode size={10} />
            <span>QR Code Ready</span>
          </div>
        )}
      </div>
      <p className="text-[10px] font-mono text-[#8b949e] mb-4">
        Choose your demo environment. Mock data shows the algorithm without real transactions.
        Testnet uses Mutinynet for live Lightning demos with QR codes.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {demoModes.map(({ mode, label, description, icon: Icon, color, badge }) => {
          const isActive = state.demoMode === mode;
          return (
            <button
              key={mode}
              onClick={() => dispatch({ type: 'SET_DEMO_MODE', mode })}
              className={`text-left rounded-lg border p-3 transition-all duration-200 ${
                isActive
                  ? 'shadow-lg'
                  : 'border-[#30363d] bg-[#0d1117] hover:border-[#58a6ff]/30'
              }`}
              style={
                isActive
                  ? {
                      borderColor: `${color}66`,
                      backgroundColor: `${color}10`,
                      boxShadow: `0 0 15px ${color}15`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} style={{ color: isActive ? color : '#8b949e' }} />
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: isActive ? color : '#c9d1d9' }}
                >
                  {label}
                </span>
              </div>
              {badge && (
                <div
                  className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded mb-1.5 inline-block"
                  style={{
                    color,
                    backgroundColor: `${color}20`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  {badge}
                </div>
              )}
              <p className="text-[9px] font-mono text-[#8b949e] leading-relaxed">
                {description}
              </p>
              {isActive && (
                <div className="mt-2 text-[9px] font-mono font-semibold" style={{ color }}>
                  ACTIVE
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Testnet QR Code placeholder */}
      {state.demoMode === 'testnet' && (
        <div className="mt-4 rounded-lg border border-[#d29922]/30 bg-[#d29922]/5 p-4 text-center">
          <div className="text-[11px] font-mono font-semibold text-[#d29922] mb-2">
            Mutinynet Lightning Invoice
          </div>
          <div className="w-32 h-32 mx-auto bg-white rounded-lg flex items-center justify-center mb-2">
            <QrCode size={80} className="text-[#0d1117]" />
          </div>
          <div className="text-[9px] font-mono text-[#8b949e]">
            Scan to fund testnet wallet (100 sats)
          </div>
          <div className="text-[9px] font-mono text-[#d29922]/60 mt-1">
            lnbcrt1u1pn...mutinynet
          </div>
        </div>
      )}
    </div>
  );
}
