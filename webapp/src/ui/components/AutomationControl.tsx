import { useStore } from '../../state/store';
import type { AutomationMode } from '../../state/types';
import { Bot, Bell, Hand } from 'lucide-react';

const modes: { mode: AutomationMode; label: string; description: string; icon: typeof Bot; color: string }[] = [
  {
    mode: 'auto',
    label: 'Auto-Migrate',
    description: 'Automatically move funds when a mint drops below critical threshold. No human intervention needed.',
    icon: Bot,
    color: '#3fb950',
  },
  {
    mode: 'alert',
    label: 'Alert Only',
    description: 'Receive alerts when trust scores change. Migration suggestions provided but require manual approval.',
    icon: Bell,
    color: '#d29922',
  },
  {
    mode: 'manual',
    label: 'Manual',
    description: 'Full manual control. View scores and allocations, decide when and where to move funds yourself.',
    icon: Hand,
    color: '#58a6ff',
  },
];

export default function AutomationControl() {
  const { state, dispatch } = useStore();

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h3 className="text-sm font-mono font-semibold text-[#c9d1d9] mb-3">
        Trust Response Mode
      </h3>
      <p className="text-[10px] font-mono text-[#8b949e] mb-4">
        Choose how L3 responds when a mint's trust score crosses risk thresholds.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {modes.map(({ mode, label, description, icon: Icon, color }) => {
          const isActive = state.automationMode === mode;
          return (
            <button
              key={mode}
              onClick={() => dispatch({ type: 'SET_AUTOMATION_MODE', mode })}
              className={`text-left rounded-lg border p-3 transition-all duration-200 ${
                isActive
                  ? 'border-opacity-50 bg-opacity-10 shadow-lg'
                  : 'border-[#30363d] bg-[#0d1117] hover:border-[#58a6ff]/30'
              }`}
              style={isActive ? {
                borderColor: `${color}66`,
                backgroundColor: `${color}10`,
                boxShadow: `0 0 15px ${color}15`,
              } : undefined}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: isActive ? color : '#8b949e' }} />
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: isActive ? color : '#c9d1d9' }}
                >
                  {label}
                </span>
              </div>
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
