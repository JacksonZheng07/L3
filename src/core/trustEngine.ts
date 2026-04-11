import { config } from './config';
import { eventBus } from './eventBus';
import { httpGet } from './network';
import type { TrustSignals, TrustScore, MintState } from '../state/types';

// ─── Individual signal evaluators ────────────────────────────

function scoreAvailability(response: { success: boolean }): number {
  return response.success ? 1 : 0;
}

function scoreLatency(latencyMs: number): number {
  const { excellent, acceptable } = config.trust.latency;
  if (latencyMs <= excellent) return 1;
  if (latencyMs <= acceptable) return 0.5;
  return 0;
}

function scoreKeysetStability(
  currentKeysets: string[] | null,
  cachedKeysets: string[]
): number {
  if (!currentKeysets) return 0;
  if (cachedKeysets.length === 0) return 1;

  const same =
    currentKeysets.length === cachedKeysets.length &&
    currentKeysets.every(k => cachedKeysets.includes(k));

  return same ? 1 : 0;
}

function scoreTxSuccess(total: number, successes: number): number {
  if (total === 0) return 1;
  return successes / total;
}

function scoreVersion(version: string | undefined): number {
  if (!version) return 0;
  return version.startsWith(config.trust.knownVersionPrefix) ? 1 : 0.5;
}

function scoreOperatorInfo(
  info: { name?: string; contact?: unknown[] } | null
): number {
  if (!info) return 0;
  const hasName = !!info.name && info.name.length > 0;
  const hasContact = Array.isArray(info.contact) && info.contact.length > 0;
  if (hasName && hasContact) return 1;
  if (hasName || hasContact) return 0.5;
  return 0;
}

// ─── Compute weighted score ──────────────────────────────────
function computeScore(signals: TrustSignals): number {
  const w = config.trust.weights;
  const raw =
    signals.availability * w.availability +
    signals.latency * w.latency +
    signals.keysetStable * w.keysetStable +
    signals.txSuccessRate * w.txSuccessRate +
    signals.versionCurrent * w.versionCurrent +
    signals.operatorInfo * w.operatorInfo;

  return Math.round(raw * 100);
}

function getGrade(score: number): 'safe' | 'warning' | 'critical' {
  if (score >= config.trust.thresholds.safe) return 'safe';
  if (score >= config.trust.thresholds.warning) return 'warning';
  return 'critical';
}

// ─── Evaluate a single mint ──────────────────────────────────
export async function evaluateMint(mintState: MintState): Promise<TrustScore> {
  const infoResult = await httpGet<{
    name?: string;
    version?: string;
    contact?: Array<{ method: string; info: string }>;
  }>(`${mintState.url}/v1/info`, config.network.timeoutMs);

  let currentKeysets: string[] | null = null;
  try {
    const ksResponse = await fetch(`${mintState.url}/v1/keysets`);
    if (ksResponse.ok) {
      const ksData = await ksResponse.json();
      currentKeysets = ksData.keysets?.map((k: { id: string }) => k.id) ?? [];
    }
  } catch {
    currentKeysets = null;
  }

  const signals: TrustSignals = {
    availability: scoreAvailability(infoResult),
    latency: infoResult.success ? scoreLatency(infoResult.latencyMs) : 0,
    keysetStable: scoreKeysetStability(currentKeysets, mintState.cachedKeysets),
    txSuccessRate: scoreTxSuccess(mintState.txTotal, mintState.txSuccess),
    versionCurrent: infoResult.success
      ? scoreVersion(infoResult.data.version)
      : 0,
    operatorInfo: infoResult.success
      ? scoreOperatorInfo(infoResult.data)
      : 0,
  };

  const score = computeScore(signals);

  return {
    signals,
    score,
    grade: getGrade(score),
    lastChecked: Date.now(),
  };
}

// ─── Explain score (human-readable) ──────────────────────────
export function explainScore(score: TrustScore): string {
  const problems: string[] = [];

  if (score.signals.availability === 0) {
    problems.push('Mint is unreachable');
  }
  if (score.signals.keysetStable === 0) {
    problems.push('Cryptographic keys changed unexpectedly');
  }
  if (score.signals.txSuccessRate < 0.9) {
    problems.push(
      `Transaction success rate is ${Math.round(score.signals.txSuccessRate * 100)}%`
    );
  }
  if (score.signals.latency === 0) {
    problems.push('Response time is very slow');
  }
  if (score.signals.operatorInfo === 0) {
    problems.push('No operator contact information');
  }
  if (score.signals.versionCurrent === 0) {
    problems.push('Running outdated or unknown software version');
  }

  if (problems.length === 0) return 'All checks passing';
  return problems.join('. ') + '.';
}

// ─── Trust loop (started once on app load) ───────────────────
let trustInterval: ReturnType<typeof setInterval> | null = null;

export function startTrustLoop(
  getMints: () => MintState[],
  updateMintScore: (url: string, score: TrustScore) => void
): void {
  if (trustInterval) return;

  const evaluate = async () => {
    const mintStates = getMints();

    for (const mint of mintStates) {
      try {
        const score = await evaluateMint(mint);
        updateMintScore(mint.url, score);

        eventBus.publish({
          type: 'TRUST_UPDATED',
          mintUrl: mint.url,
          score,
        });
      } catch (err) {
        console.error(`Trust eval failed for ${mint.url}:`, err);
      }
    }
  };

  evaluate();
  trustInterval = setInterval(evaluate, config.trust.evaluationIntervalMs);
}

export function stopTrustLoop(): void {
  if (trustInterval) {
    clearInterval(trustInterval);
    trustInterval = null;
  }
}
