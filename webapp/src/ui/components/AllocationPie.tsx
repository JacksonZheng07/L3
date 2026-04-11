import { useStore } from '../../state/store';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const gradeColor = (grade: 'safe' | 'warning' | 'critical') =>
  grade === 'safe' ? '#3fb950' : grade === 'warning' ? '#d29922' : '#f85149';

export default function AllocationPie() {
  const { effectiveScores: scores } = useStore();

  const data = scores
    .filter((s) => s.allocationPct > 0)
    .map((s) => ({
      name: s.name,
      value: Math.round(s.allocationPct * 10) / 10,
      grade: s.grade,
    }));

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 h-[280px] flex items-center justify-center">
        <span className="text-xs font-mono text-[#8b949e]">No allocations yet</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h3 className="text-sm font-mono font-semibold text-[#c9d1d9] mb-3">Fund Allocation</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="#0d1117"
              strokeWidth={2}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={gradeColor(entry.grade as 'safe' | 'warning' | 'critical')}
                  fillOpacity={0.85}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#c9d1d9',
              }}
              formatter={(value) => `${value}%`}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-[10px] font-mono text-[#8b949e]">L3</div>
            <div className="text-[10px] font-mono text-[#58a6ff]">Diversified</div>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
        {data.map((entry, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] font-mono text-[#8b949e]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: gradeColor(entry.grade as 'safe' | 'warning' | 'critical') }}
            />
            {entry.name} ({entry.value}%)
          </span>
        ))}
      </div>
    </div>
  );
}
