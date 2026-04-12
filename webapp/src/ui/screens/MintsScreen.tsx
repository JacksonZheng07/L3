import { useState } from 'react';
import { useStore } from '../../state/store';
import MintCard from '../components/MintCard';
import MintSettings from './MintSettings';
import type { MintScore } from '../../state/types';

type GradeFilter = 'all' | 'safe' | 'warning' | 'critical';

const FILTER_LABELS: Record<GradeFilter, string> = {
  all: 'All',
  safe: 'Safe',
  warning: 'Warning',
  critical: 'Critical',
};

const FILTER_COLORS: Record<GradeFilter, string> = {
  all: '#58a6ff',
  safe: '#3fb950',
  warning: '#d29922',
  critical: '#f85149',
};

export default function MintsScreen() {
  const { state, dispatch, effectiveScores } = useStore();
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');

  const filtered: MintScore[] =
    gradeFilter === 'all'
      ? effectiveScores
      : effectiveScores.filter((s) => s.grade === gradeFilter);

  const counts = {
    all: effectiveScores.length,
    safe: effectiveScores.filter((s) => s.grade === 'safe').length,
    warning: effectiveScores.filter((s) => s.grade === 'warning').length,
    critical: effectiveScores.filter((s) => s.grade === 'critical').length,
  };

  function getBalance(url: string) {
    return state.balances.find((b) => b.mintUrl === url)?.balance;
  }

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'safe', 'warning', 'critical'] as GradeFilter[]).map((f) => {
          const isActive = gradeFilter === f;
          const color = FILTER_COLORS[f];
          return (
            <button
              key={f}
              onClick={() => setGradeFilter(f)}
              className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-all duration-150"
              style={
                isActive
                  ? { color, background: `${color}12`, borderColor: `${color}40` }
                  : { color: '#8b949e', background: 'transparent', borderColor: '#21262d' }
              }
            >
              {FILTER_LABELS[f]}
              <span
                className="text-[9px] px-1 rounded"
                style={isActive ? { background: `${color}20` } : { background: '#21262d' }}
              >
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mint grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-8 text-center">
          <p className="text-xs font-mono text-[#8b949e]">
            {effectiveScores.length === 0
              ? 'No mints scored yet — click Re-score to begin.'
              : `No ${gradeFilter} mints.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((score) => (
            <div
              key={score.url}
              onClick={() => dispatch({ type: 'SET_SELECTED_MINT', url: score.url })}
            >
              <MintCard score={score} balance={getBalance(score.url)} />
            </div>
          ))}
        </div>
      )}

      {/* MintSettings slide-over panel */}
      {state.selectedMint && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => dispatch({ type: 'SET_SELECTED_MINT', url: null })}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-[640px] z-50 overflow-y-auto shadow-2xl border-l border-[#21262d]">
            <MintSettings />
          </div>
        </>
      )}
    </div>
  );
}
