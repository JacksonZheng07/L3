import { useStore } from '../../state/store';
import { Brain, TrendingDown, BarChart3, ArrowRightLeft } from 'lucide-react';

export default function MathTheory() {
  const { state, effectiveScores } = useStore();

  // Use real portfolio balance, fallback to sum of known balances or 0
  const totalExposure = state.totalBalance;
  const portfolioVaR = effectiveScores.reduce((sum, mint) => {
    const exposure = (mint.allocationPct / 100) * totalExposure;
    const mintVaR = exposure * (1 - mint.compositeScore / 100);
    return sum + mintVaR;
  }, 0);

  const safeMints = effectiveScores.filter((s) => s.grade === 'safe');
  const avgScore = effectiveScores.length > 0
    ? effectiveScores.reduce((s, m) => s + m.compositeScore, 0) / effectiveScores.length
    : 0;

  // Compare diversified vs single-mint VaR
  const bestMint = effectiveScores.length > 0
    ? effectiveScores.reduce((best, m) => (m.compositeScore > best.compositeScore ? m : best))
    : null;
  const singleMintVaR = bestMint ? totalExposure * (1 - bestMint.compositeScore / 100) : totalExposure;
  const varReduction = singleMintVaR > 0
    ? ((singleMintVaR - portfolioVaR) / singleMintVaR * 100)
    : 0;

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={16} className="text-[#a855f7]" />
        <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
          Mathematical Framework
        </h3>
      </div>
      <p className="text-[10px] font-mono text-[#8b949e] mb-4">
        The algorithm is mathematically defensible — not heuristic. Here's the formal model
        underpinning L3's scoring and allocation engine.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Composite Trust Score */}
        <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={12} className="text-[#58a6ff]" />
            <div className="text-[11px] font-mono font-semibold text-[#58a6ff]">
              4.1 Weighted Trust Score
            </div>
          </div>
          <div className="space-y-2 text-[10px] font-mono">
            <div className="bg-[#161b22] rounded p-2 border border-[#21262d]">
              <div className="text-[#c9d1d9]">T(m) = Sum(w_i * n_i(m)) * 100</div>
              <div className="text-[#8b949e] mt-1">
                where w_i = weight of signal i (Sum = 1.0)<br />
                n_i(m) = normalized value in [0, 1]
              </div>
            </div>
            <div className="text-[#8b949e] leading-relaxed">
              Linear combination of 9 normalized observables. Each signal has a mathematically
              defined normalizer and an auditable weight.
            </div>
            <div className="text-[#8b949e]">
              <span className="text-[#d29922]">Normalizers:</span>
            </div>
            <div className="bg-[#161b22] rounded p-2 border border-[#21262d] space-y-1">
              <div className="text-[#8b949e]">
                Binary: n(x) = {'{'} 1 if true, 0 if false {'}'}
              </div>
              <div className="text-[#8b949e]">
                Latency: n(x) = max(0, 1 - (x - 200) / 1800)
              </div>
              <div className="text-[#8b949e]">
                Failure: n(x) = e^(-0.7x) (exponential decay)
              </div>
              <div className="text-[#8b949e]">
                Count: n(x) = min(1, log10(x) / log10(x_max))
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio VaR */}
        <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={12} className="text-[#f85149]" />
            <div className="text-[11px] font-mono font-semibold text-[#f85149]">
              4.3 Value-at-Risk (VaR)
            </div>
          </div>
          <div className="space-y-2 text-[10px] font-mono">
            <div className="bg-[#161b22] rounded p-2 border border-[#21262d]">
              <div className="text-[#c9d1d9]">VaR(m_i) = balance(m_i) * (1 - T(m_i)/100)</div>
              <div className="text-[#8b949e] mt-1">
                Portfolio VaR = Sum(VaR(m_i))
              </div>
            </div>
            <div className="text-[#8b949e] leading-relaxed">
              Maximum expected loss from mint i is proportional to exposure times the complement
              of its trust score. Companies understand this number.
            </div>

            {/* Live VaR calculation */}
            {effectiveScores.length > 0 && (
              <div className="bg-[#161b22] rounded p-3 border border-[#f85149]/20 space-y-2">
                <div className="text-[9px] text-[#f85149] font-semibold uppercase tracking-wider">
                  Live Portfolio Analysis
                </div>
                <div className="flex justify-between text-[#8b949e]">
                  <span>Portfolio VaR</span>
                  <span className="text-[#f85149] font-semibold">
                    {Math.round(portfolioVaR).toLocaleString()} sats
                  </span>
                </div>
                <div className="flex justify-between text-[#8b949e]">
                  <span>Single-mint VaR (best)</span>
                  <span className="text-[#d29922]">
                    {Math.round(singleMintVaR).toLocaleString()} sats
                  </span>
                </div>
                <div className="flex justify-between text-[#8b949e]">
                  <span>VaR reduction from diversification</span>
                  <span className="text-[#3fb950] font-semibold">
                    {varReduction.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bayesian Updates */}
        <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={12} className="text-[#a855f7]" />
            <div className="text-[11px] font-mono font-semibold text-[#a855f7]">
              4.4 Bayesian Trust Updates
            </div>
          </div>
          <div className="space-y-2 text-[10px] font-mono">
            <div className="bg-[#161b22] rounded p-2 border border-[#21262d]">
              <div className="text-[#c9d1d9]">
                new_score = alpha * observation + (1-alpha) * prior
              </div>
              <div className="text-[#8b949e] mt-1">
                alpha = 0.1 (established mints, slow to change)<br />
                alpha = 0.4 (new mints, fast to change)
              </div>
            </div>
            <div className="text-[#8b949e] leading-relaxed">
              Exponential moving average (EMA) gives scores <span className="text-[#c9d1d9]">momentum</span>.
              A mint reliable for 1000 checks doesn't plummet from 1 failure. But 3 consecutive
              failures update fast because the evidence is stronger.
            </div>
          </div>
        </div>

        {/* Migration Decision */}
        <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft size={12} className="text-[#3fb950]" />
            <div className="text-[11px] font-mono font-semibold text-[#3fb950]">
              4.5 Migration with Hysteresis
            </div>
          </div>
          <div className="space-y-2 text-[10px] font-mono">
            <div className="bg-[#161b22] rounded p-2 border border-[#21262d]">
              <div className="text-[#c9d1d9]">
                T(m_i) {'<'} threshold AND exists m_j where T(m_j) {'>='} threshold + hysteresis
              </div>
              <div className="text-[#8b949e] mt-1">
                threshold = 50, hysteresis = 10
              </div>
            </div>
            <div className="text-[#8b949e] leading-relaxed">
              Hysteresis prevents oscillation: a mint scoring 49 triggers migration, but only migrates
              back if destination scores {'>='}60. No ping-pong between borderline mints.
            </div>

            {/* Allocation formula */}
            <div className="bg-[#161b22] rounded p-2 border border-[#21262d]">
              <div className="text-[#c9d1d9]">
                alloc(m_i) = min(0.40, T_i / Sum(T_eligible))
              </div>
              <div className="text-[#8b949e] mt-1">
                40% cap enforces diversification. Excess redistributed proportionally.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio summary */}
      {effectiveScores.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-3 text-center">
            <div className="text-lg font-mono font-bold text-[#c9d1d9]">
              {effectiveScores.length}
            </div>
            <div className="text-[9px] font-mono text-[#8b949e]">Mints Scored</div>
          </div>
          <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-3 text-center">
            <div className="text-lg font-mono font-bold text-[#3fb950]">
              {safeMints.length}
            </div>
            <div className="text-[9px] font-mono text-[#8b949e]">Safe ({'>='}75)</div>
          </div>
          <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-3 text-center">
            <div className="text-lg font-mono font-bold text-[#58a6ff]">
              {avgScore.toFixed(0)}
            </div>
            <div className="text-[9px] font-mono text-[#8b949e]">Avg Score</div>
          </div>
          <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-3 text-center">
            <div className="text-lg font-mono font-bold text-[#3fb950]">
              {varReduction.toFixed(0)}%
            </div>
            <div className="text-[9px] font-mono text-[#8b949e]">VaR Reduction</div>
          </div>
        </div>
      )}
    </div>
  );
}
