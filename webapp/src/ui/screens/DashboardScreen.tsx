import { useState } from 'react';
import { useStore } from '../../state/store';
import { selectPortfolioRisk, selectDiversificationBenefit, selectSafePct } from '../../state/selectors';
import KpiCard from '../components/KpiCard';
import ScoreChart from '../components/ScoreChart';
import AllocationPie from '../components/AllocationPie';
import MintTable from '../components/MintTable';
import ThreeCurvesChart from '../components/ThreeCurvesChart';
import PortfolioSplitPanel from '../components/PortfolioSplitPanel';
import { ShieldAlert, ShieldCheck, Zap, Clock, ChevronDown, ChevronUp } from 'lucide-react';

export default function DashboardScreen() {
  const { state, dispatch, effectiveScores } = useStore();
  const { totalBalance, balances, lastScoredAt } = state;

  const [showCurves, setShowCurves] = useState(false);

  const risk     = selectPortfolioRisk(effectiveScores, totalBalance);
  const divBenefit = selectDiversificationBenefit(effectiveScores, totalBalance);
  const safePct  = selectSafePct(effectiveScores);

  const varGrade =
    totalBalance === 0
      ? 'safe'
      : risk.var95 / totalBalance > 0.1
      ? 'critical'
      : risk.var95 / totalBalance > 0.05
      ? 'warning'
      : 'safe';

  const safeGrade =
    safePct >= 70 ? 'safe' : safePct >= 40 ? 'warning' : 'critical';

  const nextScore = (() => {
    if (!lastScoredAt) return 'Ready';
    const ms = 30000 - (Date.now() - new Date(lastScoredAt).getTime());
    if (ms <= 0) return 'Ready';
    return `${Math.ceil(ms / 1000)}s`;
  })();

  const balanceMap = new Map(balances.map((b) => [b.mintUrl, b.balance]));

  function handleMintClick(url: string) {
    dispatch({ type: 'SET_SELECTED_MINT', url });
    dispatch({ type: 'SET_VIEW', view: 'mints' });
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="VaR 95% (Gaussian)"
          value={totalBalance > 0 ? `${Math.round(risk.var95).toLocaleString()} sats` : '—'}
          subValue={
            totalBalance > 0
              ? `CVaR: ${Math.round(risk.cvar95).toLocaleString()} · div. benefit ${divBenefit.toFixed(1)}%`
              : 'Set a balance to compute'
          }
          grade={varGrade}
          icon={ShieldAlert}
        />
        <KpiCard
          label="Safe Allocation"
          value={effectiveScores.length > 0 ? `${safePct.toFixed(1)}%` : '—'}
          subValue={`${effectiveScores.filter((s) => s.grade === 'safe').length} of ${effectiveScores.length} mints safe`}
          grade={safeGrade}
          icon={ShieldCheck}
        />
        <KpiCard
          label="Total Balance"
          value={totalBalance > 0 ? `${totalBalance.toLocaleString()}` : '0'}
          subValue="sats across all mints"
          grade="safe"
          icon={Zap}
        />
        <KpiCard
          label="Next Re-score"
          value={nextScore}
          subValue={lastScoredAt ? `Last: ${new Date(lastScoredAt).toLocaleTimeString()}` : 'Click Re-score to start'}
          icon={Clock}
        />
      </div>

      {/* Portfolio split preview */}
      <PortfolioSplitPanel />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ScoreChart />
        </div>
        <div className="lg:col-span-2">
          <AllocationPie />
        </div>
      </div>

      {/* Mint table */}
      <MintTable
        scores={effectiveScores}
        balances={balanceMap}
        onMintClick={handleMintClick}
      />

      {/* Risk distribution chart — collapsible */}
      <div>
        <button
          onClick={() => setShowCurves((v) => !v)}
          className="flex items-center gap-2 text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9] transition-colors mb-3"
        >
          {showCurves ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Risk Distribution Analysis (Why Diversify?)
        </button>
        {showCurves && <ThreeCurvesChart />}
      </div>
    </div>
  );
}
