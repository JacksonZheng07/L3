import type { LucideIcon } from 'lucide-react';
import { gradeColor } from '../../lib/theme';
import { SHADOWS } from '../../lib/theme';

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  grade?: 'safe' | 'warning' | 'critical';
  icon: LucideIcon;
}

export default function KpiCard({ label, value, subValue, trend, grade, icon: Icon }: KpiCardProps) {
  const color = grade ? gradeColor(grade) : '#58a6ff';
  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null;

  return (
    <div
      className="kpi-card relative rounded-xl bg-[#161b22] border border-[#21262d] p-5 overflow-hidden cursor-default select-none"
      style={{ boxShadow: SHADOWS.card }}
    >
      {/* Colored top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />

      {/* Icon + label row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#8b949e]">
          {label}
        </span>
        <Icon size={14} style={{ color }} className="opacity-70" />
      </div>

      {/* Primary value */}
      <div
        className="text-2xl font-mono font-bold leading-none mb-1"
        style={{ color }}
      >
        {value}
        {trendSymbol && (
          <span
            className="ml-2 text-sm font-normal"
            style={{ color: trend === 'up' ? '#3fb950' : '#f85149' }}
          >
            {trendSymbol}
          </span>
        )}
      </div>

      {/* Sub-value */}
      {subValue && (
        <div className="text-[10px] font-mono text-[#8b949e] mt-1 leading-snug">
          {subValue}
        </div>
      )}
    </div>
  );
}
