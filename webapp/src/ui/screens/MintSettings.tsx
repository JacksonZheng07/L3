import { useStore } from '../../state/store';
import { gradeColor } from '../../lib/theme';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function MintSettings() {
  const { state, dispatch } = useStore();
  const { scores, selectedMint } = state;

  const mint = scores.find((s) => s.url === selectedMint);

  if (!mint) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-[#8b949e] mb-4">Mint not found</div>
          <button
            onClick={() => dispatch({ type: 'SET_SELECTED_MINT', url: null })}
            className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded border border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] transition-colors mx-auto"
          >
            <ArrowLeft size={12} /> Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] font-mono">
      {/* Header */}
      <header className="bg-[#161b22] border-b border-[#30363d]">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => dispatch({ type: 'SET_SELECTED_MINT', url: null })}
            className="flex items-center gap-2 text-xs font-mono text-[#58a6ff] hover:underline mb-3"
          >
            <ArrowLeft size={12} /> Close
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#c9d1d9] flex items-center gap-2">
                {mint.name}
                {mint.isOnline ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#3fb950] opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3fb950]" />
                  </span>
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f85149]" />
                )}
              </h1>
              <div className="flex items-center gap-1 text-xs text-[#8b949e] mt-1">
                <span className="truncate max-w-[400px]">{mint.url}</span>
                <ExternalLink size={10} />
              </div>
            </div>

            <div className="text-right">
              <div
                className="text-4xl font-bold"
                style={{ color: gradeColor(mint.grade) }}
              >
                {mint.compositeScore.toFixed(0)}
              </div>
              <div
                className="text-xs font-mono uppercase tracking-wider"
                style={{ color: gradeColor(mint.grade) }}
              >
                {mint.grade}
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="flex gap-4 mt-4">
            {[
              { label: 'Latency', value: `${mint.latencyMs}ms` },
              { label: 'Version', value: mint.version || 'unknown' },
              { label: 'Keysets', value: String(mint.keysetCount) },
              { label: 'Allocation', value: `${mint.allocationPct.toFixed(1)}%` },
              { label: 'Anonymous', value: mint.isAnonymous ? 'Yes' : 'No' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#21262d] rounded px-3 py-2">
                <div className="text-[10px] text-[#8b949e] uppercase tracking-wider">{stat.label}</div>
                <div className="text-sm text-[#c9d1d9] font-semibold">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Signal breakdown table */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-sm font-mono font-semibold text-[#8b949e] uppercase tracking-wider mb-4">
          Signal Breakdown ({mint.signals.length} signals)
        </h2>

        <div className="rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_80px_80px_80px_3fr] gap-2 px-4 py-2 bg-[#21262d] text-[10px] font-mono text-[#8b949e] uppercase tracking-wider border-b border-[#30363d]">
            <span>Signal</span>
            <span>Value</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Contrib</span>
            <span className="text-center">Source</span>
            <span>Explanation</span>
          </div>

          {/* Signal rows */}
          {mint.signals.map((signal, i) => (
            <div
              key={signal.name}
              className={`grid grid-cols-[2fr_1fr_80px_80px_80px_3fr] gap-2 px-4 py-3 items-center text-xs font-mono ${
                i % 2 === 0 ? 'bg-[#161b22]' : 'bg-[#0d1117]'
              } border-b border-[#21262d] last:border-b-0`}
            >
              {/* Signal name */}
              <span className="text-[#c9d1d9] font-semibold">
                {signal.name.replace(/_/g, ' ')}
              </span>

              {/* Value bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${signal.value * 100}%`,
                      backgroundColor:
                        signal.value >= 0.7 ? '#3fb950' : signal.value >= 0.4 ? '#d29922' : '#f85149',
                    }}
                  />
                </div>
                <span className="text-[#c9d1d9] w-8 text-right">{signal.value.toFixed(2)}</span>
              </div>

              {/* Weight */}
              <span className="text-[#8b949e] text-right">{signal.weight.toFixed(2)}</span>

              {/* Contribution */}
              <span className="text-[#c9d1d9] text-right font-semibold">
                {signal.contribution.toFixed(2)}
              </span>

              {/* Source badge */}
              <div className="flex justify-center">
                <span
                  className={`text-[9px] px-2 py-0.5 rounded ${
                    signal.source === 'allium'
                      ? 'bg-[#58a6ff]/10 text-[#58a6ff]'
                      : 'bg-[#d29922]/10 text-[#d29922]'
                  }`}
                >
                  {signal.source}
                </span>
              </div>

              {/* Explanation */}
              <span className="text-[#8b949e] text-[11px] leading-tight">
                {signal.explanation}
              </span>
            </div>
          ))}
        </div>

        {/* Scoring formula note */}
        <div className="mt-4 text-[10px] font-mono text-[#8b949e]/60 text-center">
          Composite Score = Sum(value x weight) x 100 | Scored at {new Date(mint.scoredAt).toLocaleString()}
        </div>
      </main>
    </div>
  );
}
