import { config } from './config';
import { eventBus } from './eventBus';
import { getWallet } from './walletEngine';
import type { MintState, MigrationEvent } from '../state/types';
import type { Proof } from '@cashu/cashu-ts';

let lastMigrationTime = 0;

// ─── Check if migration should trigger ───────────────────────
export function shouldMigrate(
  mints: MintState[],
  isMigrating: boolean
): { shouldMigrate: false } | {
  shouldMigrate: true;
  source: MintState;
  target: MintState;
  reason: string;
} {
  if (!config.migration.enabled) return { shouldMigrate: false };
  if (isMigrating) return { shouldMigrate: false };
  if (Date.now() - lastMigrationTime < config.migration.cooldownMs) {
    return { shouldMigrate: false };
  }

  const criticalMints = mints.filter(
    m => m.trustScore.grade === 'critical' && m.balance > config.migration.minMigrationAmount
  );

  if (criticalMints.length === 0) return { shouldMigrate: false };

  const source = criticalMints.sort(
    (a, b) => a.trustScore.score - b.trustScore.score
  )[0];

  const targets = mints.filter(
    m => m.url !== source.url && m.trustScore.grade !== 'critical'
  );

  if (targets.length === 0) return { shouldMigrate: false };

  const target = targets.sort(
    (a, b) => b.trustScore.score - a.trustScore.score
  )[0];

  const problems: string[] = [];
  const s = source.trustScore.signals;
  if (s.availability === 0) problems.push('unreachable');
  if (s.keysetStable === 0) problems.push('keyset changed');
  if (s.txSuccessRate < 0.9) problems.push('transactions failing');
  if (s.latency === 0) problems.push('very slow');

  const reason = `${source.name || source.url} scored ${source.trustScore.score}/100 (${problems.join(', ')})`;

  return { shouldMigrate: true, source, target, reason };
}

// ─── Execute migration ───────────────────────────────────────
export async function executeMigration(
  source: MintState,
  target: MintState,
  onStateUpdate: (updates: {
    removeProofs: { mintUrl: string; proofs: Proof[] };
    addProofs: { mintUrl: string; proofs: Proof[] };
    migration: MigrationEvent;
  }) => void
): Promise<MigrationEvent> {
  const migrationId = `mig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const amount = source.balance;

  const event: MigrationEvent = {
    id: migrationId,
    timestamp: Date.now(),
    fromMint: source.url,
    toMint: target.url,
    amount,
    reason: '',
    triggerScore: source.trustScore.score,
    status: 'pending',
  };

  eventBus.publish({ type: 'MIGRATION_STARTED', event });

  try {
    // Step 1: Create mint quote on target (get a Lightning invoice)
    event.status = 'minting';
    const targetWallet = getWallet(target.url);
    const mintQuote = await targetWallet.createMintQuote(amount);

    // Step 2: Melt proofs on source to pay the target's invoice
    event.status = 'melting';
    const sourceWallet = getWallet(source.url);
    const meltQuote = await sourceWallet.createMeltQuote(mintQuote.request);
    const meltResult = await sourceWallet.meltProofs(meltQuote, source.proofs);

    if (meltResult.quote.state !== 'PAID') {
      throw new Error('Melt failed — source mint did not pay the invoice');
    }

    // Step 3: Claim proofs on target
    event.status = 'minting';
    const newProofs = await targetWallet.mintProofs(amount, mintQuote.quote);

    // Step 4: Success
    event.status = 'success';
    lastMigrationTime = Date.now();

    onStateUpdate({
      removeProofs: { mintUrl: source.url, proofs: source.proofs },
      addProofs: { mintUrl: target.url, proofs: newProofs },
      migration: event,
    });

    eventBus.publish({ type: 'MIGRATION_COMPLETED', event });
    return event;

  } catch (err) {
    event.status = 'failed';
    event.error = err instanceof Error ? err.message : String(err);

    eventBus.publish({ type: 'MIGRATION_FAILED', event });
    return event;
  }
}
