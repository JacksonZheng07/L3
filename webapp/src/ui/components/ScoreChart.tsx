import { useStore } from '../../state/store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

const gradeColor = (grade: 'safe' | 'warning' | 'critical') =>
  grade === 'safe' ? '#3fb950' : grade === 'warning' ? '#d29922' : '#f85149';

export default function ScoreChart() {
  const { effectiveScores: scores } = useStore();

  const data = scores.map((s) => ({
    name: s.name.length > 14 ? s.name.slice(0, 12) + '..' : s.name,
    score: Math.round(s.compositeScore),
    grade: s.grade,
  }));

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 h-[280px] flex items-center justify-center">
        <span className="text-xs font-mono text-[#8b949e]">Scoring mints...</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h3 className="text-sm font-mono font-semibold text-[#c9d1d9] mb-3">Composite Scores</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: '#8b949e', fontSize: 10, fontFamily: 'monospace' }}
            axisLine={{ stroke: '#21262d' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fill: '#8b949e', fontSize: 10, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#c9d1d9',
            }}
          />
          <ReferenceLine
            x={75}
            stroke="#3fb950"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: 'Safe', fill: '#3fb950', fontSize: 9, fontFamily: 'monospace' }}
          />
          <ReferenceLine
            x={50}
            stroke="#f85149"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: 'Critical', fill: '#f85149', fontSize: 9, fontFamily: 'monospace' }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((entry, i) => (
              <Cell key={i} fill={gradeColor(entry.grade as 'safe' | 'warning' | 'critical')} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
