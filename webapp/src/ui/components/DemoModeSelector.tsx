import { useStore } from '../../state/store';
import type { DemoMode } from '../../state/types';
import { TestTube, Coins, Radio } from 'lucide-react';

const demoModes: {
  mode: DemoMode;
  label: string;
  description: string;
  icon: typeof TestTube;
  color: string;
  badge?: string;
}[] = [
  {
    mode: 'mutinynet',
    label: 'Mutinynet',
    description: 'Signet with real Lightning. Free faucet sats, 30s blocks. Best for demos.',
    icon: Radio,
    color: '#a855f7',
    badge: 'RECOMMENDED',
  },
  {
    mode: 'testnet',
    label: 'Testnet',
    description: 'Fake Lightning (auto-pays). Good for testing UI flows without any wallet.',
    icon: TestTube,
    color: '#d29922',
  },
  {
    mode: 'mainnet',
    label: 'Mainnet',
    description: 'Real Bitcoin. Use with caution — real money.',
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
          Network
        </h3>
      </div>

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
    </div>
  );
}
