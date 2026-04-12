import { useState } from 'react';
import type { MintScore } from '../../state/types';
import { gradeColor } from '../../lib/theme';
import { ChevronUp, ChevronDown, Wifi, WifiOff } from 'lucide-react';

type SortCol = 'name' | 'score' | 'grade' | 'latency' | 'allocation' | 'balance' | 'status';

interface MintTableProps {
  scores: MintScore[];
  balances: Map<string, number>;
  onMintClick: (url: string) => void;
}

const GRADE_ORDER = { safe: 0, warning: 1, critical: 2 } as const;

export default function MintTable({ scores, balances, onMintClick }: MintTableProps) {
  const [sortCol, setSortCol] = useState<SortCol>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'name' ? 'asc' : 'desc');
    }
  }

  const sorted = [...scores].sort((a, b) => {
    let diff = 0;
    switch (sortCol) {
      case 'name':       diff = a.name.localeCompare(b.name); break;
      case 'score':      diff = a.compositeScore - b.compositeScore; break;
      case 'grade':      diff = GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade]; break;
      case 'latency':    diff = a.latencyMs - b.latencyMs; break;
      case 'allocation': diff = a.allocationPct - b.allocationPct; break;
      case 'status':     diff = Number(a.isOnline) - Number(b.isOnline); break;
      case 'balance':    diff = (balances.get(a.url) ?? 0) - (balances.get(b.url) ?? 0); break;
    }
    return sortDir === 'asc' ? diff : -diff;
  });

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="opacity-20 ml-1">↕</span>;
    return sortDir === 'asc'
      ? <ChevronUp size={10} className="inline ml-1 text-[#58a6ff]" />
      : <ChevronDown size={10} className="inline ml-1 text-[#58a6ff]" />;
  }

  const headerCell = (label: string, col: SortCol, align = 'left') => (
    <th
      className={`px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-[#8b949e] cursor-pointer select-none hover:text-[#c9d1d9] transition-colors text-${align}`}
      onClick={() => handleSort(col)}
    >
      {label}<SortIcon col={col} />
    </th>
  );

  if (scores.length === 0) {
    return (
      <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-6 text-center">
        <span className="text-xs font-mono text-[#8b949e]">No mints scored yet — click Re-score</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#21262d] bg-[#161b22] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#21262d] bg-[#0d1117]">
              {headerCell('Mint', 'name')}
              {headerCell('Score', 'score', 'right')}
              {headerCell('Grade', 'grade')}
              {headerCell('Latency', 'latency', 'right')}
              {headerCell('Alloc %', 'allocation', 'right')}
              {headerCell('Balance', 'balance', 'right')}
              {headerCell('Status', 'status')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((score, i) => {
              const color = gradeColor(score.grade);
              const balance = balances.get(score.url) ?? 0;
              return (
                <tr
                  key={score.url}
                  onClick={() => onMintClick(score.url)}
                  className={`border-b border-[#21262d] last:border-b-0 cursor-pointer transition-colors ${
                    i % 2 === 0 ? 'bg-[#161b22]' : 'bg-[#0d1117]'
                  } hover:bg-[rgba(88,166,255,0.04)]`}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono font-semibold text-[#c9d1d9] truncate max-w-[180px] block">
                      {score.name}
                    </span>
                    <span className="text-[9px] font-mono text-[#8b949e]/60 truncate max-w-[180px] block">
                      {score.url.replace('https://', '')}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono font-bold" style={{ color }}>
                      {score.compositeScore.toFixed(0)}
                    </span>
                  </td>

                  {/* Grade badge */}
                  <td className="px-4 py-3">
                    <span
                      className="text-[9px] font-mono px-2 py-0.5 rounded font-semibold"
                      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                    >
                      {score.grade.toUpperCase()}
                    </span>
                  </td>

                  {/* Latency */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className="text-xs font-mono"
                      style={{
                        color: score.latencyMs <= 500 ? '#3fb950' : score.latencyMs <= 2000 ? '#d29922' : '#f85149',
                      }}
                    >
                      {score.isOnline ? `${score.latencyMs}ms` : '—'}
                    </span>
                  </td>

                  {/* Allocation bar */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1 bg-[#21262d] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, score.allocationPct)}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[#c9d1d9] w-10 text-right">
                        {score.allocationPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  {/* Balance */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-mono text-[#c9d1d9]">
                      {balance > 0 ? balance.toLocaleString() : '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {score.isOnline ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[#3fb950] opacity-75 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3fb950]" />
                          </span>
                          <Wifi size={10} className="text-[#3fb950]" />
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 rounded-full bg-[#f85149]" />
                          <WifiOff size={10} className="text-[#f85149]" />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
