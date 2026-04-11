import type { MintTrustScore, MintState } from '../types';

const LATEST_CASHU_VERSION = '0.16';

export function calculateTrustScore(mint: MintState): MintTrustScore {
  const infoResponsive = mint.info !== null;
  const hasOperatorInfo = !!(mint.info?.name && mint.info?.contact?.length > 0);
  const currentVersion = mint.info?.version?.includes(LATEST_CASHU_VERSION) ?? false;

  const keysetStable = mint.healthChecksFailed === 0 && mint.initialKeysetIds.length > 0;

  const rate = mint.txTotal > 0 ? (mint.txSuccess / mint.txTotal) * 100 : 100;
  const txSuccessRate = Math.min(20, Math.round((rate / 100) * 20));

  const uptimeClean = mint.healthChecksFailed === 0;

  let totalScore = 0;
  if (infoResponsive) totalScore += 20;
  if (hasOperatorInfo) totalScore += 10;
  if (currentVersion) totalScore += 10;
  if (keysetStable) totalScore += 20;
  totalScore += txSuccessRate;
  if (uptimeClean) totalScore += 20;

  return {
    infoResponsive,
    hasOperatorInfo,
    currentVersion,
    keysetStable,
    txSuccessRate,
    uptimeClean,
    totalScore,
  };
}

export function getTrustLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'High Trust', color: '#22c55e' };
  if (score >= 50) return { label: 'Moderate', color: '#eab308' };
  return { label: 'Low Trust', color: '#ef4444' };
}
