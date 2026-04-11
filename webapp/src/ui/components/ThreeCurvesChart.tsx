import { useMemo } from 'react';
import { useStore } from '../../state/store';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const gaussian = (x: number, mu: number, sigma: number) =>
  Math.exp(-0.5 * ((x - mu) / sigma) ** 2);

export default function ThreeCurvesChart() {
  const { effectiveScores: scores } = useStore();

  const curveData = useMemo(() => {
    if (scores.length === 0) return [];

    const avgScore =
      scores.reduce((sum, s) => sum + s.compositeScore, 0) / scores.length;
    const bestScore = Math.max(...scores.map((s) => s.compositeScore));

    const eligible = scores.filter((s) => s.grade !== 'critical');
    const N = Math.max(eligible.length, 1);
    const totalAlloc = eligible.reduce((s, m) => s + m.allocationPct, 0) || 1;
    const weightedAvg =
      eligible.reduce((s, m) => s + m.compositeScore * m.allocationPct, 0) /
      totalAlloc;

    const mu1 = avgScore;
    const sigma1 = 25;
    const mu2 = bestScore;
    const sigma2 = 18;
    const mu3 = weightedAvg;
    const sigma3 = 18 / Math.sqrt(N);

    const points = [];
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * 100;
      points.push({
        x: Math.round(x * 10) / 10,
        random: gaussian(x, mu1, sigma1),
        best: gaussian(x, mu2, sigma2),
        l3: gaussian(x, mu3, sigma3),
      });
    }
    return points;
  }, [scores]);

  if (curveData.length === 0) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 h-[280px] flex items-center justify-center">
        <span className="text-xs font-mono text-[#8b949e]">Waiting for scores...</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h3 className="text-sm font-mono font-semibold text-[#c9d1d9] mb-3">
        Risk Distribution: Why Diversify?
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={curveData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <XAxis
            dataKey="x"
            tick={{ fill: '#8b949e', fontSize: 10, fontFamily: 'monospace' }}
            axisLine={{ stroke: '#21262d' }}
            tickLine={false}
            label={{
              value: 'Reliability Score',
              position: 'insideBottom',
              offset: -2,
              fill: '#8b949e',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#c9d1d9',
            }}
            formatter={(value) => Number(value).toFixed(3)}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }}
            iconType="line"
          />
          <Area
            type="monotone"
            dataKey="random"
            name="Random Single Mint"
            stroke="#f85149"
            fill="#f85149"
            fillOpacity={0.1}
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="best"
            name="Best Single Mint"
            stroke="#d29922"
            fill="#d29922"
            fillOpacity={0.1}
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="l3"
            name="L3 Diversified"
            stroke="#3fb950"
            fill="#3fb950"
            fillOpacity={0.15}
            strokeWidth={2.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
