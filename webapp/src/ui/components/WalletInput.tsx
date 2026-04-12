import { useState } from 'react';
import { useStore } from '../../state/store';
import { Wallet, Plus, Minus } from 'lucide-react';

export default function WalletInput() {
  const { state, dispatch } = useStore();
  const [inputValue, setInputValue] = useState('');

  const handleSet = () => {
    const amount = parseInt(inputValue, 10);
    if (!isNaN(amount) && amount >= 0) {
      dispatch({ type: 'SET_TOTAL_BALANCE', amount });
      setInputValue('');
    }
  };

  const handleQuickAdd = (amount: number) => {
    dispatch({ type: 'SET_TOTAL_BALANCE', amount: state.totalBalance + amount });
  };

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wallet size={14} className="text-[#d29922]" />
        <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
          Portfolio Balance
        </h3>
      </div>

      {/* Current balance display */}
      <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-3 mb-3 text-center">
        <div className="text-2xl font-mono font-bold text-[#d29922]">
          {state.totalBalance.toLocaleString()}
        </div>
        <div className="text-[9px] font-mono text-[#8b949e] uppercase tracking-wider">
          sats
        </div>
      </div>

      {/* Manual input */}
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          min="0"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSet()}
          placeholder="Enter sats amount"
          className="flex-1 text-xs font-mono px-3 py-2 rounded border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] placeholder-[#8b949e]/50 focus:outline-none focus:border-[#d29922]/50"
        />
        <button
          onClick={handleSet}
          disabled={!inputValue}
          className="text-xs font-mono px-3 py-2 rounded border border-[#d29922]/30 bg-[#d29922]/10 text-[#d29922] hover:bg-[#d29922]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Set
        </button>
      </div>

      {/* Quick-add buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[10000, 50000, 100000, 500000].map((amount) => (
          <button
            key={amount}
            onClick={() => handleQuickAdd(amount)}
            className="flex items-center justify-center gap-1 text-[10px] font-mono px-2 py-1.5 rounded border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-colors"
          >
            <Plus size={8} />
            {amount >= 1000 ? `${amount / 1000}k` : amount}
          </button>
        ))}
      </div>

      {/* Reset */}
      {state.totalBalance > 0 && (
        <button
          onClick={() => dispatch({ type: 'SET_TOTAL_BALANCE', amount: 0 })}
          className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-mono px-2 py-1.5 rounded border border-[#f85149]/20 text-[#f85149]/60 hover:text-[#f85149] hover:border-[#f85149]/40 transition-colors"
        >
          <Minus size={8} /> Reset to 0
        </button>
      )}
    </div>
  );
}
