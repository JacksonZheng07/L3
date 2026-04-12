/**
 * Statistical utilities for L3 risk engine.
 * All pure functions — no imports, no side effects.
 */

// ── Error function (Abramowitz & Stegun, max error 1.5e-7) ──────────
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}

/** Cumulative distribution function of N(mu, sigma²). P(X ≤ x). */
export function normalCDF(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) return x >= mu ? 1 : 0;
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

/** Probability density function of N(mu, sigma²). */
export function normalPDF(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

/**
 * Gaussian Value-at-Risk.
 * Returns the loss level that is exceeded with probability (1 - confidence).
 * E.g. confidence=0.95 → VaR_95: 5% chance of losing this much or more.
 *
 * @param meanLoss  Expected loss (μ)
 * @param sigmaLoss Standard deviation of loss (σ)
 * @param confidence 0.95 or 0.99
 */
export function gaussianVaR(meanLoss: number, sigmaLoss: number, confidence = 0.95): number {
  // z-quantiles for common confidence levels
  const z = confidence >= 0.99 ? 2.326 : confidence >= 0.975 ? 1.960 : 1.645;
  return meanLoss + z * sigmaLoss;
}

/**
 * Conditional VaR / Expected Shortfall — the average loss *given* that the
 * loss exceeds VaR.  Always ≥ VaR.
 */
export function gaussianCVaR(meanLoss: number, sigmaLoss: number, confidence = 0.95): number {
  const alpha = 1 - confidence;
  const z = confidence >= 0.99 ? 2.326 : confidence >= 0.975 ? 1.960 : 1.645;
  // CVaR = μ + σ × φ(z) / α   where φ is standard normal PDF
  const phi = normalPDF(z);
  return meanLoss + sigmaLoss * phi / alpha;
}

/**
 * Compute portfolio-level loss distribution from per-mint score distributions.
 *
 * Assumes signal-level independence across mints (no cross-mint correlation).
 * Returns { meanLoss, sigmaLoss } in sats.
 *
 * @param mints  Array of { allocationPct, scoreMu, scoreSigma }
 * @param totalBalance  Total sats
 */
export function portfolioLossDistribution(
  mints: { allocationPct: number; scoreMu: number; scoreSigma: number }[],
  totalBalance: number,
): { meanLoss: number; sigmaLoss: number } {
  let meanLoss = 0;
  let varLoss   = 0;

  for (const m of mints) {
    const exposure = (m.allocationPct / 100) * totalBalance;
    // Expected loss per mint: exposure × (1 - μ/100)
    meanLoss += exposure * (1 - m.scoreMu / 100);
    // Variance of loss per mint: (exposure/100)² × σ²
    varLoss  += (exposure / 100) ** 2 * m.scoreSigma ** 2;
  }

  return { meanLoss, sigmaLoss: Math.sqrt(varLoss) };
}
