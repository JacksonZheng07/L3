import { useState } from 'react';
import type { MintScore } from '../../state/types';
import { ChevronDown, ChevronUp, Wifi, WifiOff, Clock, Tag, Key } from 'lucide-react';

const gradeColor = (grade: 'safe' | 'warning' | 'critical') =>
  grade === 'safe' ? '#3fb950' : grade === 'warning' ? '#d29922' : '#f85149';

const gradeBg = (grade: 'safe' | 'warning' | 'critical') =>
  grade === 'safe' ? 'bg-[#3fb950]/10' : grade === 'warning' ? 'bg-[#d29922]/10' : 'bg-[#f85149]/10';

interface MintCardProps {
  score: MintScore;
  balance?: number;
}

export default function MintCard({ score, balance }: MintCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 hover:border-[#58a6ff]/40 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          {score.isOnline ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#3fb950] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3fb950]" />
            </span>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-[#f85149]" />
          )}
          <span className="text-sm font-mono font-semibold text-[#c9d1d9] truncate max-w-[200px]">
            {score.name}
          </span>
          {score.isOnline ? (
            <Wifi size={12} className="text-[#3fb950]" />
          ) : (
            <WifiOff size={12} className="text-[#f85149]" />
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <span
            className="text-2xl font-mono font-bold"
            style={{ color: gradeColor(score.grade) }}
          >
            {score.compositeScore.toFixed(0)}
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${gradeBg(score.grade)}`}
            style={{ color: gradeColor(score.grade) }}
          >
            {score.grade.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="flex items-center gap-1 text-[10px] font-mono text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded">
          <Clock size={10} /> {score.latencyMs}ms
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded">
          <Tag size={10} /> {score.version || 'unknown'}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded">
          <Key size={10} /> {score.keysetCount} keysets
        </span>
      </div>

      {/* Allocation bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] font-mono text-[#8b949e] mb-1">
          <span>Allocation</span>
          <span>{score.allocationPct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, score.allocationPct)}%`,
              backgroundColor: gradeColor(score.grade),
            }}
          />
        </div>
      </div>

      {/* Balance */}
      {balance !== undefined && (
        <div className="text-xs font-mono text-[#8b949e] mt-2">
          Balance: <span className="text-[#c9d1d9] font-semibold">{balance.toLocaleString()} sats</span>
        </div>
      )}

      {/* Expand indicator */}
      <div className="flex justify-center mt-2 text-[#8b949e]">
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {/* Expanded signals */}
      {expanded && (
        <div className="mt-3 border-t border-[#30363d] pt-3 space-y-2">
          <div className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider mb-2">
            Signal Breakdown
          </div>
          {score.signals.map((signal) => (
            <div key={signal.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#c9d1d9]">{signal.name.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded ${
                      signal.source === 'allium' ? 'bg-[#58a6ff]/10 text-[#58a6ff]' : 'bg-[#d29922]/10 text-[#d29922]'
                    }`}
                  >
                    {signal.source}
                  </span>
                  <span className="text-[#8b949e]">w={signal.weight.toFixed(2)}</span>
                  <span className="text-[#c9d1d9] font-semibold">{signal.value.toFixed(2)}</span>
                </div>
              </div>
              {/* Value bar */}
              <div className="h-1 bg-[#21262d] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#58a6ff] transition-all duration-300"
                  style={{ width: `${signal.value * 100}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-[#8b949e]/70 pl-2">
                {signal.explanation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
