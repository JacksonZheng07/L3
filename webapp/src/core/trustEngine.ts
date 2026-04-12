/**
 * L³ Trust Engine
 * Ports all 9 signal scoring functions from weightinglogic.py.
 * Computes composite scores and allocation recommendations.
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

// ── Utility ──────────────────────────────────────────────────────────

type Dict = Record<string, unknown>;

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

function sig(
  name: string,
  value: number,
  weightKey: string,
  source: 'allium' | 'direct',
  explanation: string,
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
    rawData,
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ALLIUM-BASED SIGNALS (60 % weight)                            ║
// ╚══════════════════════════════════════════════════════════════════╝

export function scoreOperatorIdentity(
  txData: Dict | null,
  balanceData: Dict | null,
): SignalResult {
  if (txData === null && balanceData === null) {
    return sig(
      'operator_identity',
      0,
      'operator_identity',
      'allium',
      'Anonymous operator — no on-chain identity data available. Score capped at 0.',
    );
  }

  let score = 0;
  const reasons: string[] = [];

  // Entity labels
  const labels: string[] =
    txData && Array.isArray((txData as Dict).labels)
      ? ((txData as Dict).labels as string[])
      : [];

  if (labels.length > 0) {
    score += 0.4;
    reasons.push(`Known entity labels: ${labels.slice(0, 3).join(', ')}`);
  } else {
    reasons.push('No known entity labels found');
  }

  // Wallet age
  if (txData && typeof txData === 'object') {
    const transfers = Array.isArray(txData.asset_transfers)
      ? (txData.asset_transfers as Dict[])
      : [];

    if (transfers.length > 0) {
      const timestamps = transfers
        .map((t) => t.block_timestamp as string | undefined)
        .filter(Boolean) as string[];

      if (timestamps.length > 0) {
        const earliest = timestamps.reduce((a, b) => (a < b ? a : b));
        try {
          const firstTxDate = new Date(earliest);
          const ageDays = Math.floor(
            (Date.now() - firstTxDate.getTime()) / 86_400_000,
          );

          if (ageDays > 365) {
            score += 0.3;
            reasons.push(`Wallet age: ${ageDays} days (>1 year — established)`);
          } else if (ageDays > 180) {
            score += 0.2;
            reasons.push(`Wallet age: ${ageDays} days (>6 months)`);
          } else if (ageDays > 30) {
            score += 0.1;
            reasons.push(`Wallet age: ${ageDays} days (>1 month)`);
          } else {
            reasons.push(`Wallet age: ${ageDays} days (very new — higher risk)`);
          }
        } catch {
          reasons.push('Could not parse wallet age from timestamps');
        }
      }

      // Activity
      const txCount = transfers.length;
      if (txCount > 1000) {
        score += 0.2;
        reasons.push(`Transaction count: ${txCount} (highly active)`);
      } else if (txCount > 100) {
        score += 0.1;
        reasons.push(`Transaction count: ${txCount} (moderately active)`);
      } else {
        reasons.push(`Transaction count: ${txCount} (low activity)`);
      }
    }
  }

  // Balance adequacy
  if (balanceData && typeof balanceData === 'object') {
    const balances = Array.isArray((balanceData as Dict).data)
      ? ((balanceData as Dict).data as Dict[])
      : [];
    const totalUsd = balances.reduce((sum, b) => {
      const v = parseFloat(String(b.usd_value ?? '0'));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    if (totalUsd > 10_000) {
      score += 0.1;
      reasons.push(`Current holdings: $${totalUsd.toLocaleString()} (substantial)`);
    } else if (totalUsd > 1_000) {
      score += 0.05;
      reasons.push(`Current holdings: $${totalUsd.toLocaleString()} (moderate)`);
    } else {
      reasons.push(`Current holdings: $${totalUsd.toLocaleString()} (low)`);
    }
  }

  return sig(
    'operator_identity',
    clamp(score),
    'operator_identity',
    'allium',
    reasons.join(' | '),
    { labels },
  );
}

export function scoreReserveBehavior(
  balanceData: Dict | null,
  historicalData: Dict | null,
): SignalResult {
  if (balanceData === null && historicalData === null) {
    return sig(
      'reserve_behavior',
      0,
      'reserve_behavior',
      'allium',
      'No on-chain balance data available (anonymous operator). Cannot verify reserves.',
    );
  }

  let score = 0.5;
  const reasons: string[] = [];

  // Current BTC balance
  if (balanceData && typeof balanceData === 'object') {
    const balances = Array.isArray((balanceData as Dict).data)
      ? ((balanceData as Dict).data as Dict[])
      : [];
    let btcBalance = 0;
    for (const b of balances) {
      const symbol = String(b.symbol ?? '').toUpperCase();
      if (symbol === 'BTC' || symbol === 'BITCOIN') {
        btcBalance = parseFloat(String(b.amount ?? '0'));
      }
    }
    if (btcBalance > 0) {
      score += 0.2;
      reasons.push(`Current BTC reserves: ${btcBalance.toFixed(8)} BTC`);
    } else {
      score -= 0.2;
      reasons.push('No detectable BTC reserves — high risk');
    }
  }

  // Historical trend
  if (historicalData && typeof historicalData === 'object') {
    const history = Array.isArray((historicalData as Dict).data)
      ? ((historicalData as Dict).data as Dict[])
      : [];

    if (history.length >= 2) {
      const over = history
        .map((e) => ({
          ts: String(e.block_timestamp ?? ''),
          amt: parseFloat(String(e.amount ?? '0')),
        }))
        .sort((a, b) => (a.ts < b.ts ? -1 : 1));

      const oldBal = over[0].amt;
      const newBal = over[over.length - 1].amt;

      if (oldBal > 0) {
        const changePct = ((newBal - oldBal) / oldBal) * 100;

        if (changePct >= 0) {
          score += 0.3;
          reasons.push(`Reserve trend: +${changePct.toFixed(1)}% (stable or growing)`);
        } else if (changePct > -20) {
          score += 0.1;
          reasons.push(`Reserve trend: ${changePct.toFixed(1)}% (minor decline)`);
        } else if (changePct > -50) {
          score -= 0.2;
          reasons.push(`Reserve trend: ${changePct.toFixed(1)}% (significant decline — WARNING)`);
        } else {
          score -= 0.4;
          reasons.push(`Reserve trend: ${changePct.toFixed(1)}% (severe decline — CRITICAL)`);
        }

        // Sudden large drops
        if (over.length >= 5) {
          let maxDrop = 0;
          for (let i = 1; i < over.length; i++) {
            const prev = over[i - 1].amt;
            const curr = over[i].amt;
            if (prev > 0) {
              const drop = ((curr - prev) / prev) * 100;
              maxDrop = Math.min(maxDrop, drop);
            }
          }
          if (maxDrop < -30) {
            score -= 0.3;
            reasons.push(
              `Sudden drop detected: ${maxDrop.toFixed(1)}% in single period — possible exit preparation`,
            );
          }
        }
      }
    } else {
      reasons.push('Insufficient historical data for trend analysis');
    }
  }

  return sig(
    'reserve_behavior',
    clamp(score),
    'reserve_behavior',
    'allium',
    reasons.length > 0 ? reasons.join(' | ') : 'Insufficient data for analysis',
  );
}

export function scoreTransactionPatterns(txData: Dict | null): SignalResult {
  if (txData === null) {
    return sig(
      'transaction_patterns',
      0,
      'transaction_patterns',
      'allium',
      'No transaction data available (anonymous operator).',
    );
  }

  const transfers = Array.isArray(txData.asset_transfers)
    ? (txData.asset_transfers as Dict[])
    : [];

  if (transfers.length === 0) {
    return sig(
      'transaction_patterns',
      0.3,
      'transaction_patterns',
      'allium',
      'No transfers found — limited data for pattern analysis.',
    );
  }

  let score = 0.5;
  const reasons: string[] = [];

  // Unique counterparties
  const counterparties = new Set<string>();
  for (const t of transfers) {
    if (t.from_address) counterparties.add(String(t.from_address));
    if (t.to_address) counterparties.add(String(t.to_address));
  }

  const uniqueCount = counterparties.size;
  if (uniqueCount > 100) {
    score += 0.25;
    reasons.push(`Diverse counterparties: ${uniqueCount} unique addresses (healthy)`);
  } else if (uniqueCount > 20) {
    score += 0.15;
    reasons.push(`Moderate counterparties: ${uniqueCount} unique addresses`);
  } else if (uniqueCount > 5) {
    score += 0.05;
    reasons.push(`Few counterparties: ${uniqueCount} unique addresses (concentrated)`);
  } else {
    score -= 0.2;
    reasons.push(`Very few counterparties: ${uniqueCount} — possible fake activity`);
  }

  // Circular patterns
  const senders = new Set<string>();
  const receivers = new Set<string>();
  for (const t of transfers) {
    if (t.from_address) senders.add(String(t.from_address));
    if (t.to_address) receivers.add(String(t.to_address));
  }
  const allAddrs = new Set([...senders, ...receivers]);
  const circular = [...senders].filter((a) => receivers.has(a));
  const circularRatio = circular.length / Math.max(allAddrs.size, 1);

  if (circularRatio > 0.5) {
    score -= 0.2;
    reasons.push(
      `High circular activity: ${(circularRatio * 100).toFixed(0)}% of addresses appear as both sender and receiver — possible wash trading`,
    );
  } else if (circularRatio > 0.2) {
    score -= 0.05;
    reasons.push(`Some circular activity: ${(circularRatio * 100).toFixed(0)}% overlap`);
  } else {
    score += 0.1;
    reasons.push(`Low circular activity: ${(circularRatio * 100).toFixed(0)}% (normal)`);
  }

  // Volume
  const txCount = transfers.length;
  if (txCount > 500) {
    score += 0.15;
    reasons.push(`High volume: ${txCount} transfers (active mint)`);
  } else if (txCount > 50) {
    score += 0.05;
    reasons.push(`Moderate volume: ${txCount} transfers`);
  } else {
    reasons.push(`Low volume: ${txCount} transfers (limited history)`);
  }

  return sig(
    'transaction_patterns',
    clamp(score),
    'transaction_patterns',
    'allium',
    reasons.join(' | '),
  );
}

export function scoreCounterpartyNetwork(txData: Dict | null): SignalResult {
  if (txData === null) {
    return sig(
      'counterparty_network',
      0,
      'counterparty_network',
      'allium',
      'No transaction data available (anonymous operator).',
    );
  }

  let score = 0.5;
  const reasons: string[] = [];

  const labels: string[] = Array.isArray(txData.labels)
    ? (txData.labels as string[])
    : [];
  const activities: Dict[] = Array.isArray(txData.activities)
    ? (txData.activities as Dict[])
    : [];

  if (labels.length > 0) {
    score += 0.3;
    reasons.push(`Operator has ${labels.length} entity label(s): ${labels.slice(0, 3).join(', ')}`);
  } else {
    reasons.push('No entity labels on operator address');
  }

  const legitimateActivities = activities.filter((a) =>
    ['dex_trade', 'asset_bridge', 'dex_liquidity_pool_mint'].includes(
      String(a.type ?? ''),
    ),
  );
  if (legitimateActivities.length > 0) {
    score += 0.2;
    reasons.push(
      `Known DeFi activity: ${legitimateActivities.length} legitimate transactions`,
    );
  } else {
    reasons.push('No recognized DeFi activity patterns');
  }

  return sig(
    'counterparty_network',
    clamp(score),
    'counterparty_network',
    'allium',
    reasons.join(' | '),
  );
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  DIRECT PROBE SIGNALS (40 % weight)                            ║
// ╚══════════════════════════════════════════════════════════════════╝

export function scoreAvailability(
  infoResult: ProbeResult['info'],
): SignalResult {
  const isUp = infoResult.success;
  return sig(
    'availability',
    isUp ? 1.0 : 0.0,
    'availability',
    'direct',
    isUp
      ? 'Mint is online and responding'
      : 'Mint is UNREACHABLE — all operations will fail',
  );
}

export function scoreLatency(infoResult: ProbeResult['info']): SignalResult {
  const latency = infoResult.latencyMs;

  let value: number;
  let explanation: string;

  if (latency <= LATENCY_EXCELLENT) {
    value = 1.0;
    explanation = `Response time: ${latency}ms (excellent)`;
  } else if (latency <= LATENCY_ACCEPTABLE) {
    value = 0.5;
    explanation = `Response time: ${latency}ms (acceptable but slower than ideal)`;
  } else {
    value = 0.0;
    explanation = `Response time: ${latency}ms (very slow — infrastructure concern)`;
  }

  return sig('latency', value, 'latency', 'direct', explanation);
}

export function scoreKeysetStability(
  keysetResult: ProbeResult['keysets'],
  cachedKeysets: string[],
): SignalResult {
  const current = keysetResult.keysetIds;

  if (!keysetResult.success) {
    return sig(
      'keyset_stability',
      0,
      'keyset_stability',
      'direct',
      'Could not fetch keysets — mint may be partially offline',
    );
  }

  if (cachedKeysets.length === 0) {
    return sig(
      'keyset_stability',
      1.0,
      'keyset_stability',
      'direct',
      `Initial keyset captured: ${current.length} active keyset(s). Will monitor for changes.`,
      { keysets: current },
    );
  }

  const cachedSet = new Set(cachedKeysets);
  const currentSet = new Set(current);

  if (
    cachedSet.size === currentSet.size &&
    [...cachedSet].every((k) => currentSet.has(k))
  ) {
    return sig(
      'keyset_stability',
      1.0,
      'keyset_stability',
      'direct',
      `Keysets stable: ${current.length} keyset(s), no changes detected`,
      { keysets: current },
    );
  }

  const added = [...currentSet].filter((k) => !cachedSet.has(k));
  const removed = [...cachedSet].filter((k) => !currentSet.has(k));

  return sig(
    'keyset_stability',
    0.0,
    'keyset_stability',
    'direct',
    `KEYSET CHANGED. Added: ${added.length > 0 ? added.join(', ') : 'none'}. ` +
      `Removed: ${removed.length > 0 ? removed.join(', ') : 'none'}. ` +
      'This could indicate key rotation (maintenance) or an attempt to invalidate outstanding tokens (malicious).',
    { current, cached: cachedKeysets },
  );
}

export function scoreTxSuccessRate(
  total: number,
  successful: number,
): SignalResult {
  if (total === 0) {
    return sig(
      'tx_success_rate',
      1.0,
      'tx_success_rate',
      'direct',
      'No transactions recorded yet — scoring at 1.0 (benefit of the doubt)',
    );
  }

  const rate = successful / total;
  let value: number;
  let desc: string;

  if (rate > 0.98) {
    value = 1.0;
    desc = 'excellent';
  } else if (rate > 0.95) {
    value = 0.7;
    desc = 'good with minor failures';
  } else if (rate > 0.9) {
    value = 0.4;
    desc = 'concerning failure rate';
  } else {
    value = 0.0;
    desc = 'high failure rate — unreliable';
  }

  return sig(
    'tx_success_rate',
    value,
    'tx_success_rate',
    'direct',
    `Success rate: ${(rate * 100).toFixed(1)}% (${successful}/${total}) — ${desc}`,
  );
}

export function scoreProtocolVersion(
  infoResult: ProbeResult['info'],
): SignalResult {
  if (!infoResult.success) {
    return sig(
      'protocol_version',
      0,
      'protocol_version',
      'direct',
      'Could not determine version — mint unreachable',
    );
  }

  const data = infoResult.data ?? {};
  const version = String(data.version ?? '');

  if (!version) {
    return sig(
      'protocol_version',
      0.2,
      'protocol_version',
      'direct',
      'Mint does not report version — cannot verify software currency',
    );
  }

  if (version.startsWith(KNOWN_VERSION_PREFIX)) {
    return sig(
      'protocol_version',
      1.0,
      'protocol_version',
      'direct',
      `Version ${version} — current stable release`,
    );
  }

  return sig(
    'protocol_version',
    0.5,
    'protocol_version',
    'direct',
    `Version ${version} — not the expected ${KNOWN_VERSION_PREFIX}.x (may be outdated or custom build)`,
  );
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  COMPOSITE SCORING                                              ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Normalize raw Allium API responses into the format the scoring functions expect.
 *
 * Allium returns: { items: [...] }
 * - /wallet/transactions items have: labels, asset_transfers, block_timestamp, etc.
 * - /wallet/balances items have: raw_balance, decimals, chain, address
 * - /wallet/balances/history items have: raw_balance, block_timestamp, etc.
 *
 * The scoring functions expect a flat dict with:
 *   txData: { labels, asset_transfers: [...], activities: [...] }
 *   balanceData: { data: [{ symbol, amount, usd_value }] }
 *   historicalData: { data: [{ block_timestamp, amount }] }
 */
function normalizeAlliumTxData(raw: Dict | null): Dict | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? (raw.items as Dict[]) : [];
  if (items.length === 0) return null;

  // Aggregate all asset_transfers and labels across all tx items
  const allTransfers: Dict[] = [];
  const allLabels = new Set<string>();

  for (const item of items) {
    // Labels from each transaction
    if (Array.isArray(item.labels)) {
      for (const l of item.labels as string[]) allLabels.add(l);
    }
    // Asset transfers
    if (Array.isArray(item.asset_transfers)) {
      for (const t of item.asset_transfers as Dict[]) {
        allTransfers.push({
          ...t,
          block_timestamp: t.block_timestamp ?? item.block_timestamp,
          from_address: t.from_address,
          to_address: t.to_address,
        });
      }
    }
  }

  return {
    labels: [...allLabels],
    asset_transfers: allTransfers,
    activities: items.filter((i) => i.type),
  };
}

function normalizeAlliumBalanceData(raw: Dict | null): Dict | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? (raw.items as Dict[]) : [];
  if (items.length === 0) return null;

  const data = items.map((item) => {
    const decimals = Number(item.decimals ?? 8);
    const rawBalance = Number(item.raw_balance ?? 0);
    const amount = rawBalance / Math.pow(10, decimals);
    return {
      symbol: String((item.asset as Dict)?.symbol ?? item.symbol ?? 'BTC').toUpperCase(),
      amount,
      usd_value: String(item.usd_value ?? 0),
    };
  });

  return { data };
}

function normalizeAlliumHistoricalData(raw: Dict | null): Dict | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? (raw.items as Dict[]) : [];
  if (items.length === 0) return null;

  const data = items.map((item) => {
    const decimals = Number(item.decimals ?? 8);
    const rawBalance = Number(item.raw_balance ?? 0);
    return {
      block_timestamp: item.block_timestamp,
      amount: rawBalance / Math.pow(10, decimals),
    };
  });

  return { data };
}

export async function scoreMint(
  mintConfig: MintConfig,
  probeResult: ProbeResult,
  cachedKeysets: string[],
): Promise<MintScore> {
  const { url, name, operatorAddresses } = mintConfig;
  const isAnonymous = operatorAddresses.length === 0;

  // Allium data — fetch raw, then normalize into scoring format
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

    txData = normalizeAlliumTxData(rawTx);
    balanceData = normalizeAlliumBalanceData(rawBalance);
    historicalData = normalizeAlliumHistoricalData(rawHistory);

    console.log(`[TrustEngine] Allium data for ${name}:`, {
      txItems: rawTx ? (rawTx.items as unknown[])?.length ?? 0 : 'null',
      balanceItems: rawBalance ? (rawBalance.items as unknown[])?.length ?? 0 : 'null',
      historyItems: rawHistory ? (rawHistory.items as unknown[])?.length ?? 0 : 'null',
    });
  }

  const signals: SignalResult[] = [
    // Allium signals
    scoreOperatorIdentity(txData, balanceData),
    scoreReserveBehavior(balanceData, historicalData),
    scoreTransactionPatterns(txData),
    scoreCounterpartyNetwork(txData),
    // Direct probe signals
    scoreAvailability(probeResult.info),
    scoreLatency(probeResult.info),
    scoreKeysetStability(probeResult.keysets, cachedKeysets),
    scoreTxSuccessRate(0, 0), // tracked from real operations over time
    scoreProtocolVersion(probeResult.info),
  ];

  const compositeScore =
    Math.round(signals.reduce((s, r) => s + r.contribution, 0) * 1000) / 10;

  let grade: MintScore['grade'];
  if (compositeScore >= THRESHOLD_SAFE) {
    grade = 'safe';
  } else if (compositeScore >= THRESHOLD_WARNING) {
    grade = 'warning';
  } else {
    grade = 'critical';
  }

  const infoData = probeResult.info.data ?? {};
  const version = String(infoData.version ?? '');

  return {
    url,
    name,
    isAnonymous,
    signals,
    compositeScore,
    grade,
    allocationPct: 0, // set in computeAllocation
    scoredAt: new Date().toISOString(),
    isOnline: probeResult.info.success,
    latencyMs: probeResult.info.latencyMs,
    version,
    keysetCount: probeResult.keysets.keysetIds.length,
  };
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ALLOCATION ALGORITHM                                           ║
// ╚══════════════════════════════════════════════════════════════════╝

export function computeAllocation(scores: MintScore[]): MintScore[] {
  const maxPct = MAX_ALLOCATION * 100;

  const eligible = scores.filter((s) => s.grade !== 'critical');
  const critical = scores.filter((s) => s.grade === 'critical');

  for (const s of critical) {
    s.allocationPct = 0;
  }

  if (eligible.length === 0) return scores;

  const totalScore = eligible.reduce((sum, s) => sum + s.compositeScore, 0);

  for (const s of eligible) {
    s.allocationPct =
      Math.round((s.compositeScore / totalScore) * 1000) / 10;
  }

  // Iteratively cap and redistribute
  let capped = true;
  while (capped) {
    capped = false;
    let excess = 0;
    const underCap: MintScore[] = [];

    for (const s of eligible) {
      if (s.allocationPct > maxPct) {
        excess += s.allocationPct - maxPct;
        s.allocationPct = maxPct;
        capped = true;
      } else {
        underCap.push(s);
      }
    }

    if (excess > 0 && underCap.length > 0) {
      const perMint = excess / underCap.length;
      for (const s of underCap) {
        s.allocationPct =
          Math.round((s.allocationPct + perMint) * 10) / 10;
      }
    }
  }

  return scores;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  BATCH SCORING                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

export async function scoreAllMints(
  mints: MintConfig[],
  probeResults: Map<string, ProbeResult>,
  cachedKeysets: Map<string, string[]>,
): Promise<MintScore[]> {
  const settled = await Promise.allSettled(
    mints.map((m) => {
      const probe = probeResults.get(m.url) ?? {
        info: { success: false, latencyMs: 99999, data: null },
        keysets: { success: false, keysetIds: [] },
      };
      const cached = cachedKeysets.get(m.url) ?? [];
      return scoreMint(m, probe, cached);
    }),
  );

  const results: MintScore[] = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      console.warn(`[TrustEngine] Failed to score ${mints[i].name}:`, outcome.reason);
    }
  }

  return computeAllocation(results);
}
