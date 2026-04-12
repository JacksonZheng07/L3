import { useStore } from '../../state/store';
import SimulationPanel from '../components/SimulationPanel';
import AutomationControl from '../components/AutomationControl';
import WalletInput from '../components/WalletInput';
import DemoModeSelector from '../components/DemoModeSelector';

export default function SimulationScreen() {
  const { state } = useStore();

  return (
    <div className="flex gap-5 items-start">
      {/* Left sidebar: wallet + demo + automation */}
      <div className="w-60 shrink-0 space-y-4">
        <WalletInput />
        <DemoModeSelector />
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Automation mode — compact, relevant here since it affects simulation behavior */}
        <AutomationControl />

        <SimulationPanel />

        {/* Help text */}
        <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
          <p className="text-[11px] font-mono text-[#8b949e] leading-relaxed">
            <span className="text-[#c9d1d9] font-semibold">How it works:</span> Simulation
            perturbs your live mint scores using the same trust scoring algorithm. The{' '}
            <span className="text-[#a855f7]">purple border</span> shows simulation is active.
            Switch automation mode above to see how L3 responds: Manual (dashboard only),
            Alert (migration suggested), or Auto (funds move automatically).
          </p>
          {state.simulationActive && (
            <div className="mt-2 text-[10px] font-mono text-[#a855f7] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />
              Simulation active — dashboard shows simulated scores
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
