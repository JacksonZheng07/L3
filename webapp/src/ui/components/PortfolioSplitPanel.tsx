import { useState, useEffect } from 'react';
import { useStore } from '../../state/store';
import { gradeColor } from '../../lib/theme';
import { Zap, Plus, Check, RefreshCw } from 'lucide-react';

const QUICK_AMOUNTS = [
  { label: '10k', value: 10_000 },
  { label: '50k', value: 50_000 },
  { label: '100k', value: 100_000 },
  { label: '500k', value: 500_000 },
  { label: '1M', value: 1_000_000 },
];

export default function PortfolioSplitPanel() {
  const { state, dispatch, effectiveScores } = useStore();
  const { totalBalance } = state;

  // Local preview amount — separate from committed store balance
  const [inputStr, setInputStr] = useState('');
  const [applied, setApplied] = useState(false);

  // The amount shown in the split bars: local input if typed, else store total
  const previewAmount = (() => {
    const parsed = parseInt(inputStr.replace(/,/g, ''), 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : totalBalance;
  })();

  // Auto-populate the input when store balance changes externally
  useEffect(() => {
    if (inputStr === '' && totalBalance > 0) {
      setInputStr(totalBalance.toLocaleString());
    }
  }, [totalBalance]);

  function handleInput(raw: string) {
    setApplied(false);
    // Allow digits and commas only
    const cleaned = raw.replace(/[^\d,]/g, '');
    setInputStr(cleaned);
  }

  function handleQuick(amount: number) {
    setApplied(false);
    setInputStr(amount.toLocaleString());
  }

  function handleApply() {
    const parsed = parseInt(inputStr.replace(/,/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 0) {
      dispatch({ type: 'SET_TOTAL_BALANCE', amount: parsed });
      setApplied(true);
      setTimeout(() => setApplied(false), 1500);
    }
  }

  function handleReset() {
    dispatch({ type: 'SET_TOTAL_BALANCE', amount: 0 });
    setInputStr('');
    setApplied(false);
  }

  const eligibleScores = effectiveScores.filter((s) => s.allocationPct > 0);
  const hasScores = eligibleScores.length > 0;

  return (
    <div className="rounded-xl border border-[#21262d] bg-[#161b22] overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-[#d29922]" />
          <span className="text-sm font-mono font-semibold text-[#c9d1d9]">
            Portfolio Split
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20">
            LIVE PREVIEW
          </span>
        </div>
        {totalBalance > 0 && (
          <button
            onClick={handleReset}
            className="text-[9px] font-mono text-[#8b949e] hover:text-[#f85149] transition-colors flex items-center gap-1"
          >
            <RefreshCw size={9} /> Reset
          </button>
        )}
      </div>

      {/* Input row */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Amount input */}
          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter sats amount…"
              value={inputStr}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              className="w-full text-sm font-mono pl-3 pr-14 py-2 rounded-lg border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] placeholder-[#8b949e]/40 focus:outline-none focus:border-[#d29922]/60 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#8b949e]/60 pointer-events-none">
              sats
            </span>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_AMOUNTS.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => handleQuick(value)}
                className="flex items-center gap-0.5 text-[10px] font-mono px-2 py-1.5 rounded-lg border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-all"
              >
                <Plus size={8} />{label}
              </button>
            ))}
          </div>

          {/* Apply */}
          <button
            onClick={handleApply}
            disabled={!inputStr}
            className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={
              applied
                ? { background: 'rgba(63,185,80,0.15)', borderColor: 'rgba(63,185,80,0.4)', color: '#3fb950' }
                : { background: 'rgba(210,153,34,0.12)', borderColor: 'rgba(210,153,34,0.35)', color: '#d29922' }
            }
          >
            {applied ? <><Check size={10} /> Applied</> : 'Apply'}
          </button>
        </div>

        {/* Preview total */}
        {previewAmount > 0 && (
          <p className="text-[10px] font-mono text-[#8b949e] mt-2">
            Splitting{' '}
            <span className="text-[#d29922] font-semibold">{previewAmount.toLocaleString()} sats</span>
            {previewAmount !== totalBalance && (
              <span className="text-[#8b949e]/60 ml-1">(preview — click Apply to save)</span>
            )}
          </p>
        )}
      </div>

      {/* Split bars */}
      <div className="px-5 pb-5">
        {!hasScores ? (
          <div className="rounded-lg border border-dashed border-[#30363d] p-6 text-center">
            <p className="text-xs font-mono text-[#8b949e]">
              Click <span className="text-[#c9d1d9]">Re-score</span> first — split is based on live trust scores.
            </p>
          </div>
        ) : previewAmount === 0 ? (
          <div className="rounded-lg border border-dashed border-[#30363d] p-6 text-center">
            <p className="text-xs font-mono text-[#8b949e]">
              Enter an amount above to preview how L3 would split it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 pb-1 border-b border-[#21262d]">
              <span>Mint</span>
              <span className="text-right w-16">Sharpe</span>
              <span className="text-right w-14">Kelly</span>
              <span className="text-right w-8">±σ</span>
              <span className="text-right w-28">Amount</span>
            </div>

            {eligibleScores.map((score) => {
              const satAmount    = Math.round((score.allocationPct / 100) * previewAmount);
              const kellySats    = Math.round(((score.kellyAllocation ?? 0) / 100) * previewAmount);
              const color        = gradeColor(score.grade);
              const sharpeBarPct = score.allocationPct;
              const kellyBarPct  = score.kellyAllocation ?? 0;
              const sigmaColor   = (score.scoreSigma ?? 0) < 8 ? '#3fb950' : (score.scoreSigma ?? 0) < 15 ? '#d29922' : '#f85149';

              return (
                <div key={score.url} className="space-y-1.5">
                  {/* Row: name + allocations + sigma + sats */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs font-mono text-[#c9d1d9] truncate">{score.name}</span>
                      <span
                        className="text-[8px] font-mono px-1 py-0.5 rounded shrink-0"
                        style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}
                      >
                        {score.grade.toUpperCase()}
                      </span>
                      {/* Velocity indicator */}
                      {score.velocity !== 0 && (
                        <span className="text-[8px] font-mono shrink-0" style={{ color: score.velocity > 0 ? '#3fb950' : '#f85149' }}>
                          {score.velocity > 0 ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[#58a6ff] text-right w-16 tabular-nums">
                      {score.allocationPct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-mono text-[#a855f7] text-right w-14 tabular-nums">
                      {(score.kellyAllocation ?? 0).toFixed(1)}%
                    </span>
                    <span className="text-[9px] font-mono text-right w-8 tabular-nums" style={{ color: sigmaColor }}>
                      {(score.scoreSigma ?? 0).toFixed(0)}
                    </span>
                    <span className="text-xs font-mono font-semibold text-right w-28 tabular-nums" style={{ color }}>
                      {satAmount.toLocaleString()}
                    </span>
                  </div>

                  {/* Dual allocation bar: Sharpe (solid) + Kelly (ghost) */}
                  <div className="relative h-2 bg-[#21262d] rounded-full overflow-hidden">
                    {/* Kelly ghost bar */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${kellyBarPct}%`, background: '#a855f720' }}
                    />
                    {/* Sharpe bar */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${sharpeBarPct}%`,
                        background: `linear-gradient(90deg, ${color}cc, ${color})`,
                        boxShadow: `0 0 8px ${color}40`,
                      }}
                    />
                  </div>

                  {/* Kelly sats annotation (only when differs from Sharpe) */}
                  {Math.abs(satAmount - kellySats) > 10 && (
                    <div className="flex items-center gap-1 text-[9px] font-mono text-[#a855f7]/70">
                      <span className="h-1 w-1 rounded-full bg-[#a855f7]/40" />
                      Kelly → {kellySats.toLocaleString()} sats
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total row */}
            <div className="pt-3 mt-1 border-t border-[#21262d] grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
              <span className="text-[10px] font-mono text-[#8b949e]">Total ({eligibleScores.length} mints)</span>
              <span className="text-[10px] font-mono text-[#58a6ff] text-right w-16 tabular-nums">
                {eligibleScores.reduce((s, m) => s + m.allocationPct, 0).toFixed(1)}%
              </span>
              <span className="text-[10px] font-mono text-[#a855f7] text-right w-14 tabular-nums">
                {eligibleScores.reduce((s, m) => s + (m.kellyAllocation ?? 0), 0).toFixed(1)}%
              </span>
              <span className="w-8" />
              <span className="text-xs font-mono font-bold text-[#c9d1d9] text-right w-28 tabular-nums">
                {eligibleScores.reduce((s, m) => s + Math.round((m.allocationPct / 100) * previewAmount), 0).toLocaleString()}
              </span>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-[9px] font-mono text-[#8b949e]/60 pt-1">
              <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-[#58a6ff]" /> Sharpe (primary)</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-[#a855f7]/40" /> Kelly (reference)</span>
              <span className="flex items-center gap-1"><span style={{ color: '#d29922' }}>±σ</span> score uncertainty</span>
            </div>

            {/* Rounding note if there's any dust */}
            {(() => {
              const allocated = eligibleScores.reduce(
                (s, m) => s + Math.round((m.allocationPct / 100) * previewAmount),
                0,
              );
              const dust = previewAmount - allocated;
              return dust !== 0 ? (
                <p className="text-[9px] font-mono text-[#8b949e]/50">
                  {Math.abs(dust)} sat{Math.abs(dust) !== 1 ? 's' : ''} rounding dust
                  {dust > 0 ? ' added to top mint' : ' trimmed'}
                </p>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
