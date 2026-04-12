/**
 * L³ Trust Engine
 *
 * Computes composite trust scores for Cashu/Fedimint mints using 9 signals
 * across two source categories:
 *   • Allium on-chain intelligence  (60% total weight)
 *   • Direct mint probes            (40% total weight)
 *
 * Each signal carries a point estimate (value) AND an uncertainty (sigma).
 * The composite score is modeled as a Gaussian N(μ, σ²), enabling:
 *   - Probabilistic grades (pSafe, pWarning, pCritical) instead of hard thresholds
 *   - Sharpe-ratio portfolio weights that penalise uncertain mints
 *   - Kelly-criterion sizing as a second opinion on allocation
 *   - Momentum-adjusted scoring via score velocity
 */

import type { MintConfig, SignalResult, MintScore, ProbeResult } from '../state/types';
import {
  WEIGHTS,
  THRESHOLD_SAFE,
  THRESHOLD_WARNING,
  LATENCY_EXCELLENT,
  LATENCY_ACCEPTABLE,
  KNOWN_VERSION_PREFIX,
  MAX_ALLOCATION,
} from './config';
import {
  fetchWalletTransactions,
  fetchWalletBalances,
  fetchHistoricalBalances,
} from './network';
import { normalCDF } from '../lib/stats';

// ── Constants ────────────────────────────────────────────────────────
/** Weight applied to score velocity when computing adjusted score */
const MOMENTUM_LAMBDA = 0.3;
/** Cap on Sharpe ratio to prevent numerical blow-up when σ → 0 */
const MAX_SHARPE = 10;

// ── Helpers ──────────────────────────────────────────────────────────

type Dict = Record<string, unknown>;

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Build a SignalResult.
 *
 * @param sigma  Uncertainty of the signal's point estimate (0 = certain, 0.5 = max).
 *               Drives spread of the composite score distribution.
 */
function sig(
  name: string,
  value: number,
  weightKey: string,
  source: 'allium' | 'direct',
  explanation: string,
  sigma: number,
  rawData?: Dict,
): SignalResult {
  const weight = WEIGHTS[weightKey];
  return {
    name,
    value: Math.round(value * 1000) / 1000,
    weight,
    contribution: Math.round(value * weight * 10000) / 10000,
    source,
    explanation,
    sigma: clamp(sigma),
    rawData,
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ALLIUM-BASED SIGNALS (60 % total weight)                      ║
// ╚══════════════════════════════════════════════════════════════════╝

export function scoreOperatorIdentity(
  txData: Dict | null,
  balanceData: Dict | null,
  isAnonymous = false,
): SignalResult {
  if (isAnonymous) {
    // No on-chain addresses — operator is unverified, not necessarily malicious.
    // Anonymous operators are common in the Cashu ecosystem.
    // Use moderate-risk score with high sigma to reflect inability to verify.
    return sig('operator_identity', 0.4, 'operator_identity', 'allium',
      'Anonymous operator — no on-chain addresses. Cannot verify identity (high uncertainty).', 0.35);
  }
  if (txData === null && balanceData === null) {
    // Has addresses but Allium API unavailable (no key / proxy down).
    return sig('operator_identity', 0.5, 'operator_identity', 'allium',
      'Operator address on-chain but Allium API unavailable — neutral estimate (high uncertainty).', 0.40);
  }

  let score = 0;
  const reasons: string[] = [];

  const labels: string[] = txData && Array.isArray((txData as Dict).labels)
    ? ((txData as Dict).labels as string[]) : [];

  if (labels.length > 0) {
    score += 0.4;
    reasons.push(`Known entity labels: ${labels.slice(0, 3).join(', ')}`);
  } else {
    reasons.push('No known entity labels found');
  }

  const transfers = txData && Array.isArray(txData.asset_transfers)
    ? (txData.asset_transfers as Dict[]) : [];

  let ageDays = 0;
  if (transfers.length > 0) {
    const timestamps = transfers
      .map((t) => t.block_timestamp as string | undefined)
      .filter(Boolean) as string[];

    if (timestamps.length > 0) {
      const earliest = timestamps.reduce((a, b) => (a < b ? a : b));
      try {
        ageDays = Math.floor((Date.now() - new Date(earliest).getTime()) / 86_400_000);
        if (ageDays > 365)       { score += 0.3; reasons.push(`Wallet age: ${ageDays}d (>1yr — established)`); }
        else if (ageDays > 180)  { score += 0.2; reasons.push(`Wallet age: ${ageDays}d (>6mo)`); }
        else if (ageDays > 30)   { score += 0.1; reasons.push(`Wallet age: ${ageDays}d (>1mo)`); }
        else                     { reasons.push(`Wallet age: ${ageDays}d (very new — higher risk)`); }
      } catch { /* ignore parse failure */ }
    }

    const txCount = transfers.length;
    if (txCount > 1000)       { score += 0.2; reasons.push(`TX count: ${txCount} (highly active)`); }
    else if (txCount > 100)   { score += 0.1; reasons.push(`TX count: ${txCount} (moderate)`); }
    else                      { reasons.push(`TX count: ${txCount} (low)`); }
  }

  if (balanceData && typeof balanceData === 'object') {
    const balances = Array.isArray((balanceData as Dict).data)
      ? ((balanceData as Dict).data as Dict[]) : [];
    const totalUsd = balances.reduce((s, b) => {
      const v = parseFloat(String(b.usd_value ?? '0'));
      return s + (isNaN(v) ? 0 : v);
    }, 0);
    if (totalUsd > 10_000)   { score += 0.1;  reasons.push(`Holdings: $${totalUsd.toLocaleString()} (substantial)`); }
    else if (totalUsd > 1000){ score += 0.05; reasons.push(`Holdings: $${totalUsd.toLocaleString()} (moderate)`); }
    else                      { reasons.push(`Holdings: $${totalUsd.toLocaleString()} (low)`); }
  }

  // Sigma: less data → more uncertain
  const txCount = transfers.length;
  const sigma = txCount > 1000 ? 0.10 : txCount > 100 ? 0.20 : txCount > 10 ? 0.30 : 0.40;

  return sig('operator_identity', clamp(score), 'operator_identity', 'allium',
    reasons.join(' | '), sigma, { labels });
}

export function scoreReserveBehavior(
  balanceData: Dict | null,
  historicalData: Dict | null,
  isAnonymous = false,
): SignalResult {
  if (isAnonymous) {
    return sig('reserve_behavior', 0.4, 'reserve_behavior', 'allium',
      'Anonymous operator — reserves unverifiable. Moderate-risk estimate (high uncertainty).', 0.35);
  }
  if (balanceData === null && historicalData === null) {
    return sig('reserve_behavior', 0.5, 'reserve_behavior', 'allium',
      'Allium API unavailable — cannot verify reserves. Neutral estimate (high uncertainty).', 0.40);
  }

  let score = 0.5;
  const reasons: string[] = [];

  if (balanceData && typeof balanceData === 'object') {
    const balances = Array.isArray((balanceData as Dict).data)
      ? ((balanceData as Dict).data as Dict[]) : [];
    let btcBalance = 0;
    for (const b of balances) {
      const sym = String(b.symbol ?? '').toUpperCase();
      if (sym === 'BTC' || sym === 'BITCOIN')
        btcBalance = parseFloat(String(b.amount ?? '0'));
    }
    if (btcBalance > 0) { score += 0.2; reasons.push(`BTC reserves: ${btcBalance.toFixed(8)}`); }
    else               { score -= 0.2; reasons.push('No detectable BTC reserves — high risk'); }
  }

  const history = historicalData && Array.isArray((historicalData as Dict).data)
    ? ((historicalData as Dict).data as Dict[]) : [];

  if (history.length >= 2) {
    const sorted = history
      .map((e) => ({ ts: String(e.block_timestamp ?? ''), amt: parseFloat(String(e.amount ?? '0')) }))
      .sort((a, b) => (a.ts < b.ts ? -1 : 1));

    const oldBal = sorted[0].amt;
    const newBal = sorted[sorted.length - 1].amt;

    if (oldBal > 0) {
      const changePct = ((newBal - oldBal) / oldBal) * 100;
      if (changePct >= 0)          { score += 0.3;  reasons.push(`Reserve trend: +${changePct.toFixed(1)}% (stable/growing)`); }
      else if (changePct > -20)    { score += 0.1;  reasons.push(`Reserve trend: ${changePct.toFixed(1)}% (minor decline)`); }
      else if (changePct > -50)    { score -= 0.2;  reasons.push(`Reserve trend: ${changePct.toFixed(1)}% (significant decline — WARNING)`); }
      else                         { score -= 0.4;  reasons.push(`Reserve trend: ${changePct.toFixed(1)}% (severe decline — CRITICAL)`); }

      if (sorted.length >= 5) {
        let maxDrop = 0;
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1].amt;
          if (prev > 0) maxDrop = Math.min(maxDrop, ((sorted[i].amt - prev) / prev) * 100);
        }
        if (maxDrop < -30) {
          score -= 0.3;
          reasons.push(`Sudden drop: ${maxDrop.toFixed(1)}% in single period — possible exit`);
        }
      }
    }
  } else {
    reasons.push('Insufficient historical data for trend analysis');
  }

  const sigma = history.length >= 10 ? 0.12 : history.length >= 3 ? 0.22 : 0.32;
  return sig('reserve_behavior', clamp(score), 'reserve_behavior', 'allium',
    reasons.join(' | ') || 'Insufficient data', sigma);
}

export function scoreTransactionPatterns(txData: Dict | null, isAnonymous = false): SignalResult {
  if (isAnonymous) {
    return sig('transaction_patterns', 0.4, 'transaction_patterns', 'allium',
      'Anonymous operator — transaction patterns unverifiable. Moderate-risk estimate (high uncertainty).', 0.35);
  }
  if (txData === null) {
    return sig('transaction_patterns', 0.5, 'transaction_patterns', 'allium',
      'Allium API unavailable — cannot analyse transaction patterns. Neutral estimate.', 0.38);
  }

  const transfers = Array.isArray(txData.asset_transfers)
    ? (txData.asset_transfers as Dict[]) : [];

  if (transfers.length === 0) {
    return sig('transaction_patterns', 0.3, 'transaction_patterns', 'allium',
      'No transfers found — limited data for pattern analysis.', 0.30);
  }

  let score = 0.5;
  const reasons: string[] = [];

  const counterparties = new Set<string>();
  const senders = new Set<string>();
  const receivers = new Set<string>();
  for (const t of transfers) {
    if (t.from_address) { counterparties.add(String(t.from_address)); senders.add(String(t.from_address)); }
    if (t.to_address)   { counterparties.add(String(t.to_address));   receivers.add(String(t.to_address)); }
  }

  const uniqueCount = counterparties.size;
  if (uniqueCount > 100)     { score += 0.25; reasons.push(`Diverse counterparties: ${uniqueCount} (healthy)`); }
  else if (uniqueCount > 20) { score += 0.15; reasons.push(`Moderate counterparties: ${uniqueCount}`); }
  else if (uniqueCount > 5)  { score += 0.05; reasons.push(`Few counterparties: ${uniqueCount} (concentrated)`); }
  else                       { score -= 0.20; reasons.push(`Very few counterparties: ${uniqueCount} — possible fake activity`); }

  const allAddrs = new Set([...senders, ...receivers]);
  const circularRatio = [...senders].filter((a) => receivers.has(a)).length / Math.max(allAddrs.size, 1);
  if (circularRatio > 0.5)       { score -= 0.20; reasons.push(`High circular activity: ${(circularRatio * 100).toFixed(0)}% — possible wash trading`); }
  else if (circularRatio > 0.2)  { score -= 0.05; reasons.push(`Some circular activity: ${(circularRatio * 100).toFixed(0)}%`); }
  else                           { score += 0.10; reasons.push(`Low circular activity: ${(circularRatio * 100).toFixed(0)}% (normal)`); }

  const txCount = transfers.length;
  if (txCount > 500)       { score += 0.15; reasons.push(`High volume: ${txCount} transfers`); }
  else if (txCount > 50)   { score += 0.05; reasons.push(`Moderate volume: ${txCount} transfers`); }
  else                     { reasons.push(`Low volume: ${txCount} transfers`); }

  const sigma = txCount > 500 ? 0.10 : txCount > 50 ? 0.20 : 0.32;
  return sig('transaction_patterns', clamp(score), 'transaction_patterns', 'allium',
    reasons.join(' | '), sigma);
}

export function scoreCounterpartyNetwork(txData: Dict | null, isAnonymous = false): SignalResult {
  if (isAnonymous) {
    return sig('counterparty_network', 0.4, 'counterparty_network', 'allium',
      'Anonymous operator — counterparty network unverifiable. Moderate-risk estimate (high uncertainty).', 0.35);
  }
  if (txData === null) {
    return sig('counterparty_network', 0.5, 'counterparty_network', 'allium',
      'Allium API unavailable — cannot analyse counterparty network. Neutral estimate.', 0.38);
  }

  let score = 0.5;
  const reasons: string[] = [];

  const labels: string[] = Array.isArray(txData.labels) ? (txData.labels as string[]) : [];
  const activities: Dict[] = Array.isArray(txData.activities) ? (txData.activities as Dict[]) : [];

  if (labels.length > 0) { score += 0.3; reasons.push(`${labels.length} entity label(s): ${labels.slice(0, 3).join(', ')}`); }
  else                    { reasons.push('No entity labels on operator address'); }

  const legit = activities.filter((a) =>
    ['dex_trade', 'asset_bridge', 'dex_liquidity_pool_mint'].includes(String(a.type ?? '')));
  if (legit.length > 0) { score += 0.2; reasons.push(`DeFi activity: ${legit.length} known transactions`); }
  else                  { reasons.push('No recognized DeFi activity'); }

  const sigma = labels.length > 0 || activities.length > 10 ? 0.18 : 0.28;
  return sig('counterparty_network', clamp(score), 'counterparty_network', 'allium',
    reasons.join(' | '), sigma);
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  DIRECT PROBE SIGNALS (40 % total weight)                      ║
// ╚══════════════════════════════════════════════════════════════════╝

export function scoreAvailability(infoResult: ProbeResult['info']): SignalResult {
  const isUp = infoResult.success;
  // Binary and deterministic — very low uncertainty
  return sig('availability', isUp ? 1.0 : 0.0, 'availability', 'direct',
    isUp ? 'Mint is online and responding' : 'Mint UNREACHABLE — all operations will fail',
    0.05);
}

export function scoreLatency(infoResult: ProbeResult['info']): SignalResult {
  const ms = infoResult.latencyMs;
  let value: number;
  let explanation: string;

  if (ms <= LATENCY_EXCELLENT)      { value = 1.0; explanation = `${ms}ms (excellent)`; }
  else if (ms <= LATENCY_ACCEPTABLE){ value = 0.5; explanation = `${ms}ms (acceptable)`; }
  else                              { value = 0.0; explanation = `${ms}ms (very slow — concern)`; }

  // Network jitter adds moderate uncertainty; latency can vary run-to-run
  return sig('latency', value, 'latency', 'direct', `Response time: ${explanation}`, 0.12);
}

export function scoreKeysetStability(
  keysetResult: ProbeResult['keysets'],
  cachedKeysets: string[],
): SignalResult {
  const current = keysetResult.keysetIds;

  if (!keysetResult.success) {
    return sig('keyset_stability', 0, 'keyset_stability', 'direct',
      'Could not fetch keysets — mint may be partially offline', 0.08);
  }

  if (cachedKeysets.length === 0) {
    return sig('keyset_stability', 1.0, 'keyset_stability', 'direct',
      `Initial keyset captured: ${current.length} active keyset(s). Will monitor for changes.`,
      0.05, { keysets: current });
  }

  const cachedSet = new Set(cachedKeysets);
  const currentSet = new Set(current);

  if (cachedSet.size === currentSet.size && [...cachedSet].every((k) => currentSet.has(k))) {
    return sig('keyset_stability', 1.0, 'keyset_stability', 'direct',
      `Keysets stable: ${current.length} keyset(s), no changes`, 0.05, { keysets: current });
  }

  const added   = [...currentSet].filter((k) => !cachedSet.has(k));
  const removed = [...cachedSet].filter((k) => !currentSet.has(k));
  return sig('keyset_stability', 0.0, 'keyset_stability', 'direct',
    `KEYSET CHANGED — added: ${added.length}, removed: ${removed.length}. ` +
    'Could be maintenance (key rotation) or malicious token invalidation.',
    0.05, { current, cached: cachedKeysets });
}

export function scoreTxSuccessRate(total: number, successful: number): SignalResult {
  if (total === 0) {
    // No history yet: give benefit of the doubt (1.0) but high uncertainty
    return sig('tx_success_rate', 1.0, 'tx_success_rate', 'direct',
      'No transactions recorded — defaulting to 1.0 (no evidence of failures)', 0.30);
  }

  const rate = successful / total;
  let value: number;
  let desc: string;

  if (rate > 0.98)      { value = 1.0; desc = 'excellent'; }
  else if (rate > 0.95) { value = 0.7; desc = 'good (minor failures)'; }
  else if (rate > 0.90) { value = 0.4; desc = 'concerning'; }
  else                  { value = 0.0; desc = 'high failure rate — unreliable'; }

  // Uncertainty decreases as sample size grows (CLT)
  const sigma = total > 500 ? 0.05 : total > 50 ? 0.12 : 0.20;
  return sig('tx_success_rate', value, 'tx_success_rate', 'direct',
    `Success rate: ${(rate * 100).toFixed(1)}% (${successful}/${total}) — ${desc}`, sigma);
}

export function scoreProtocolVersion(infoResult: ProbeResult['info']): SignalResult {
  if (!infoResult.success) {
    return sig('protocol_version', 0, 'protocol_version', 'direct',
      'Could not determine version — mint unreachable', 0.05);
  }

  const version = String(infoResult.data?.version ?? '');
  if (!version) {
    return sig('protocol_version', 0.2, 'protocol_version', 'direct',
      'Mint does not report version', 0.05);
  }
  if (version.startsWith(KNOWN_VERSION_PREFIX)) {
    return sig('protocol_version', 1.0, 'protocol_version', 'direct',
      `Version ${version} — current stable release`, 0.05);
  }
  return sig('protocol_version', 0.5, 'protocol_version', 'direct',
    `Version ${version} — not ${KNOWN_VERSION_PREFIX}.x (may be outdated)`, 0.05);
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ALLIUM DATA NORMALISATION                                      ║
// ╚══════════════════════════════════════════════════════════════════╝

function normalizeAlliumTxData(raw: Dict | null): Dict | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? (raw.items as Dict[]) : [];
  if (items.length === 0) return null;

  const allTransfers: Dict[] = [];
  const allLabels = new Set<string>();
  for (const item of items) {
    if (Array.isArray(item.labels)) for (const l of item.labels as string[]) allLabels.add(l);
    if (Array.isArray(item.asset_transfers)) {
      for (const t of item.asset_transfers as Dict[]) {
        allTransfers.push({ ...t, block_timestamp: t.block_timestamp ?? item.block_timestamp });
      }
    }
  }

  return { labels: [...allLabels], asset_transfers: allTransfers, activities: items.filter((i) => i.type) };
}

function normalizeAlliumBalanceData(raw: Dict | null): Dict | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? (raw.items as Dict[]) : [];
  if (items.length === 0) return null;

  const data = items.map((item) => {
    const decimals = Number(item.decimals ?? 8);
    const amount   = Number(item.raw_balance ?? 0) / Math.pow(10, decimals);
    const symbol   = String((item.asset as Dict)?.symbol ?? item.symbol ?? 'BTC').toUpperCase();
    return { symbol, amount, usd_value: String(symbol === 'BTC' ? amount * 100_000 : 0) };
  });

  return { data };
}

function normalizeAlliumHistoricalData(raw: Dict | null): Dict | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? (raw.items as Dict[]) : [];
  if (items.length === 0) return null;

  const data = items.map((item) => ({
    block_timestamp: item.block_timestamp,
    amount: Number(item.raw_balance ?? 0) / Math.pow(10, Number(item.decimals ?? 8)),
  }));

  return { data };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  COMPOSITE SCORING                                              ║
// ╚══════════════════════════════════════════════════════════════════╝

export async function scoreMint(
  mintConfig: MintConfig,
  probeResult: ProbeResult,
  cachedKeysets: string[],
  prevScore = 0,  // previous composite score for velocity
): Promise<MintScore> {
  const { url, name, operatorAddresses } = mintConfig;
  const isAnonymous = operatorAddresses.length === 0;

  let txData: Dict | null = null;
  let balanceData: Dict | null = null;
  let historicalData: Dict | null = null;

  if (!isAnonymous) {
    const primary = operatorAddresses[0];
    const [rawTx, rawBalance, rawHistory] = await Promise.all([
      fetchWalletTransactions(primary),
      fetchWalletBalances(primary),
      fetchHistoricalBalances(primary),
    ]);
    txData        = normalizeAlliumTxData(rawTx);
    balanceData   = normalizeAlliumBalanceData(rawBalance);
    historicalData = normalizeAlliumHistoricalData(rawHistory);

    console.log(`[TrustEngine] Allium data for ${name}:`, {
      txItems:      rawTx      ? (rawTx.items as unknown[])?.length      ?? 0 : 'null',
      balanceItems: rawBalance ? (rawBalance.items as unknown[])?.length ?? 0 : 'null',
      historyItems: rawHistory ? (rawHistory.items as unknown[])?.length ?? 0 : 'null',
    });
  }

  const signals: SignalResult[] = [
    scoreOperatorIdentity(txData, balanceData, isAnonymous),
    scoreReserveBehavior(balanceData, historicalData, isAnonymous),
    scoreTransactionPatterns(txData, isAnonymous),
    scoreCounterpartyNetwork(txData, isAnonymous),
    scoreAvailability(probeResult.info),
    scoreLatency(probeResult.info),
    scoreKeysetStability(probeResult.keysets, cachedKeysets),
    scoreTxSuccessRate(0, 0),
    scoreProtocolVersion(probeResult.info),
  ];

  // ── Composite μ ──────────────────────────────────────────────────
  const compositeScore =
    Math.round(signals.reduce((s, r) => s + r.contribution, 0) * 1000) / 10;

  // ── Composite σ (error propagation for weighted sum) ────────────
  // Var(composite) = Σ (weight_i × sigma_i)²  → σ = sqrt(Var) × 100
  const compositeVariance = signals.reduce((s, r) => s + (r.weight * r.sigma) ** 2, 0);
  const scoreSigma = Math.round(Math.sqrt(compositeVariance) * 100 * 10) / 10;

  // ── Probabilistic grades using Gaussian CDF ──────────────────────
  // Clamp sigma to avoid degeneracy; minimum 2 points of uncertainty
  const sigma = Math.max(scoreSigma, 2);
  const pSafe     = 1 - normalCDF(THRESHOLD_SAFE,    compositeScore, sigma);
  const pCritical =     normalCDF(THRESHOLD_WARNING, compositeScore, sigma);
  const pWarning  = Math.max(0, 1 - pSafe - pCritical);

  // Grade = argmax of the three probabilities
  const grade: MintScore['grade'] =
    pSafe >= pWarning && pSafe >= pCritical ? 'safe' :
    pCritical > pWarning                    ? 'critical' :
                                              'warning';

  // ── Score velocity & momentum-adjusted score ─────────────────────
  const velocity      = compositeScore - prevScore;
  const adjustedScore = clamp(compositeScore + MOMENTUM_LAMBDA * velocity, 0, 100);

  // ── Kelly criterion allocation (filled in by computeAllocation) ──
  const kellyAllocation = 0; // placeholder

  const infoData = probeResult.info.data ?? {};

  return {
    url, name, isAnonymous, signals,
    compositeScore, scoreSigma,
    pSafe, pWarning, pCritical, grade,
    velocity, adjustedScore,
    allocationPct: 0,   // filled by computeAllocation
    kellyAllocation,    // filled by computeAllocation
    scoredAt: new Date().toISOString(),
    isOnline: probeResult.info.success,
    latencyMs: probeResult.info.latencyMs,
    version: String(infoData.version ?? ''),
    keysetCount: probeResult.keysets.keysetIds.length,
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ALLOCATION ALGORITHM                                           ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Compute portfolio allocations using two complementary methods:
 *
 * 1. **Sharpe-weighted** (stored in `allocationPct`) — the primary allocation.
 *    Weight ∝ (adjustedScore − warningThreshold) / scoreSigma.
 *    Penalises uncertain mints: a high score with lots of uncertainty is
 *    worth less than a moderately high score with tight confidence bounds.
 *
 * 2. **Kelly criterion** (stored in `kellyAllocation`) — a second-opinion
 *    sizing based on the probability-of-safety vs probability-of-loss.
 *    kelly_i = max(0, 2 × pSafe_i − 1), then normalised.
 *
 * Both are capped at MAX_ALLOCATION (40%) with iterative redistribution.
 */
export function computeAllocation(scores: MintScore[]): MintScore[] {
  const maxPct = MAX_ALLOCATION * 100;

  const eligible = scores.filter((s) => s.grade !== 'critical');
  const critical  = scores.filter((s) => s.grade === 'critical');

  for (const s of critical) {
    s.allocationPct   = 0;
    s.kellyAllocation = 0;
  }

  if (eligible.length === 0) return scores;

  // ── Sharpe weights ────────────────────────────────────────────────
  const sharpes = eligible.map((s) => {
    const sigma  = Math.max(s.scoreSigma, 1); // prevent division by zero
    const excess = s.adjustedScore - THRESHOLD_WARNING;
    return clamp(excess / sigma, 0, MAX_SHARPE);
  });

  const totalSharpe = sharpes.reduce((a, b) => a + b, 0);

  if (totalSharpe === 0) {
    // All eligible mints score exactly at/below warning threshold — equal weight
    eligible.forEach((s) => { s.allocationPct = Math.min(100 / eligible.length, maxPct); });
  } else {
    eligible.forEach((s, i) => {
      s.allocationPct = Math.round((sharpes[i] / totalSharpe) * 1000) / 10;
    });
  }

  // Apply 40% cap + redistribute iteratively
  capAndRedistribute(eligible, maxPct);

  // ── Kelly criterion ──────────────────────────────────────────────
  const kellys = eligible.map((s) => Math.max(0, 2 * s.pSafe - 1));
  const totalKelly = kellys.reduce((a, b) => a + b, 0);

  if (totalKelly === 0) {
    eligible.forEach((s) => { s.kellyAllocation = 0; });
  } else {
    eligible.forEach((s, i) => {
      s.kellyAllocation = Math.round((kellys[i] / totalKelly) * 1000) / 10;
    });
    capAndRedistribute(eligible, maxPct, 'kellyAllocation');
  }

  return scores;
}

/** Iteratively cap allocations at maxPct and redistribute excess. */
function capAndRedistribute(
  mints: MintScore[],
  maxPct: number,
  field: 'allocationPct' | 'kellyAllocation' = 'allocationPct',
): void {
  let iterations = 0;
  while (iterations++ < 20) {
    let excess = 0;
    const underCap: MintScore[] = [];

    for (const s of mints) {
      if (s[field] > maxPct) {
        excess += s[field] - maxPct;
        s[field] = maxPct;
      } else {
        underCap.push(s);
      }
    }

    if (excess <= 0 || underCap.length === 0) break;

    const perMint = excess / underCap.length;
    for (const s of underCap) {
      s[field] = Math.round((s[field] + perMint) * 10) / 10;
    }
  }
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  BATCH SCORING                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

export async function scoreAllMints(
  mints: MintConfig[],
  probeResults: Map<string, ProbeResult>,
  cachedKeysets: Map<string, string[]>,
  prevScores: Map<string, number> = new Map(),
): Promise<MintScore[]> {
  const settled = await Promise.allSettled(
    mints.map((m) => {
      const probe = probeResults.get(m.url) ?? {
        info: { success: false, latencyMs: 99999, data: null },
        keysets: { success: false, keysetIds: [] },
      };
      const cached = cachedKeysets.get(m.url) ?? [];
      const prev   = prevScores.get(m.url) ?? 0;
      return scoreMint(m, probe, cached, prev);
    }),
  );

  const results: MintScore[] = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') results.push(outcome.value);
    else console.warn(`[TrustEngine] Failed to score ${mints[i].name}:`, outcome.reason);
  }

  return computeAllocation(results);
}
