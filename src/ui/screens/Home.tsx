import { useEffect, useRef } from 'react';
import { useAppState, useDispatch, getMintList, getTotalBalance } from '../../state/store';
import { initMint } from '../../core/walletEngine';
import { startTrustLoop, stopTrustLoop } from '../../core/trustEngine';
import { shouldMigrate, executeMigration } from '../../core/migrationEngine';
import { config } from '../../core/config';
import { TrustSpectrum } from '../components/TrustSpectrum';
import { MintCard } from '../components/MintCard';
import { MigrationLog } from '../components/MigrationLog';
import { TxHistory } from '../components/TxHistory';

interface Props {
  onNavigate: (screen: 'receive' | 'send' | 'settings') => void;
}

export function Home({ onNavigate }: Props) {
  const state = useAppState();
  const dispatch = useDispatch();
  const stateRef = useRef(state);
  stateRef.current = state;

  const mints = getMintList(state);
  const totalBalance = getTotalBalance(state);

  useEffect(() => {
    initMint(config.mints.a);
    initMint(config.mints.b);

    startTrustLoop(
      () => getMintList(stateRef.current),
      (url, score) => {
        dispatch({ type: 'UPDATE_TRUST_SCORE', mintUrl: url, score });

        const currentState = stateRef.current;
        const result = shouldMigrate(getMintList(currentState), currentState.isMigrating);
        if (result.shouldMigrate) {
          dispatch({ type: 'SET_MIGRATING', value: true });
          executeMigration(result.source, result.target, (updates) => {
            dispatch({ type: 'REMOVE_PROOFS', mintUrl: updates.removeProofs.mintUrl, proofs: updates.removeProofs.proofs });
            dispatch({ type: 'ADD_PROOFS', mintUrl: updates.addProofs.mintUrl, proofs: updates.addProofs.proofs });
            dispatch({ type: 'ADD_MIGRATION', event: updates.migration });
            dispatch({ type: 'SET_MIGRATING', value: false });
          }).catch(() => {
            dispatch({ type: 'SET_MIGRATING', value: false });
          });
        }
      }
    );

    return () => stopTrustLoop();
  }, [dispatch]);

  useEffect(() => {
    if (!state.graduationShown && totalBalance >= config.ui.graduationThresholdDemo) {
      onNavigate('settings');
    }
  }, [totalBalance, state.graduationShown, onNavigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white noise">
      {/* Ambient glow behind balance */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-lg mx-auto px-5 pt-10 pb-24 space-y-8 stagger-children">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight prism-text">
            PRISM
          </h1>
          <p className="text-[13px] text-white/30 font-light tracking-wide">
            Multi-mint Cashu wallet
          </p>
        </div>

        {/* Balance Card */}
        <div className="text-center py-6">
          <div className="inline-flex items-baseline gap-2">
            <span className="font-display text-6xl font-bold tracking-tight text-white">
              {totalBalance.toLocaleString()}
            </span>
            <span className="text-lg font-medium text-white/25 tracking-wide">sats</span>
          </div>
          <div className="prism-line w-32 mx-auto mt-4" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('receive')}
            className="btn-primary flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 py-3.5 rounded-2xl"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-80">
              <path d="M8 2v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Receive
          </button>
          <button
            onClick={() => onNavigate('send')}
            className="btn-primary flex-1 flex items-center justify-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 hover:border-orange-500/30 py-3.5 rounded-2xl"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-80">
              <path d="M8 14V2m0 0L4 6m4-4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Send
          </button>
        </div>

        {/* Trust Spectrum */}
        <TrustSpectrum />

        {/* Mints */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-xs font-semibold text-white/40 uppercase tracking-[0.15em]">
              Mints
            </h2>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs text-white/20 hover:text-white/50 transition-colors"
            >
              Details
            </button>
          </div>
          <div className="space-y-2">
            {mints.map(mint => (
              <MintCard key={mint.url} mint={mint} />
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="space-y-3">
          <h2 className="font-display text-xs font-semibold text-white/40 uppercase tracking-[0.15em] px-1">
            Activity
          </h2>
          <TxHistory />
        </div>

        {/* Migrations */}
        {state.migrations.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-xs font-semibold text-white/40 uppercase tracking-[0.15em] px-1">
              Auto-Migrations
            </h2>
            <MigrationLog />
          </div>
        )}
      </div>

      {/* Migrating Toast */}
      {state.isMigrating && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="glass-elevated flex items-center gap-3 px-5 py-3 rounded-full glow-amber">
            <div className="w-2 h-2 rounded-full bg-amber-400 status-dot status-dot-yellow" />
            <span className="text-sm font-medium text-white/80">Migrating funds...</span>
          </div>
        </div>
      )}
    </div>
  );
}
