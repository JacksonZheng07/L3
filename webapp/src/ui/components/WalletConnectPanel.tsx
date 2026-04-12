import React, { useState } from 'react';
import { useStore } from '../../state/store';
import { mnemonicToSeed, validateMnemonicLength } from '../../lib/bip39';
import type { WalletConnection } from '../../state/types';
import { Wallet, ShieldCheck, AlertTriangle, Loader, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

const STATUS_ICON: Record<string, React.ReactNode> = {
  idle:       <span className="h-2 w-2 rounded-full bg-[#30363d]" />,
  connecting: <Loader size={10} className="animate-spin text-[#d29922]" />,
  connected:  <CheckCircle size={10} className="text-[#3fb950]" />,
  failed:     <XCircle size={10} className="text-[#f85149]" />,
};

export default function WalletConnectPanel() {
  const { state, dispatch, connectWallet, refreshBalances } = useStore();
  const { demoMode, discoveredMints, balances } = state;

  const [mnemonic, setMnemonic] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [status, setStatus] = useState<WalletConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mnemonicWords = mnemonic.trim().split(/\s+/).filter(Boolean);
  const mnemonicOk = mnemonic.trim() === '' || validateMnemonicLength(mnemonic);

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      let seed: Uint8Array | undefined;
      if (mnemonic.trim() !== '') {
        if (!validateMnemonicLength(mnemonic)) {
          setError('Mnemonic must be 12, 18, or 24 words.');
          return;
        }
        seed = await mnemonicToSeed(mnemonic.trim());
      }
      const result = await connectWallet(seed);
      setStatus(result);
      refreshBalances();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="rounded-xl border border-[#21262d] bg-[#161b22] overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#21262d]">
        <Wallet size={15} className="text-[#58a6ff]" />
        <span className="text-sm font-mono font-semibold text-[#c9d1d9]">Wallet Connect</span>
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
          style={
            demoMode === 'mutinynet'
              ? { background: 'rgba(168,85,247,0.1)', color: '#a855f7', borderColor: 'rgba(168,85,247,0.25)' }
              : demoMode === 'testnet'
              ? { background: 'rgba(210,153,34,0.1)', color: '#d29922', borderColor: 'rgba(210,153,34,0.25)' }
              : { background: 'rgba(63,185,80,0.1)', color: '#3fb950', borderColor: 'rgba(63,185,80,0.25)' }
          }
        >
          {demoMode.toUpperCase()}
        </span>
        {status?.connected && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-[#3fb950]">
            <CheckCircle size={10} /> Connected
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Mode selector */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-2">
            Network Mode
          </div>
          <div className="flex gap-2">
            {(['mutinynet', 'testnet', 'mainnet'] as const).map((m) => (
              <button
                key={m}
                onClick={() => dispatch({ type: 'SET_DEMO_MODE', mode: m })}
                className="flex-1 py-1.5 text-[11px] font-mono rounded-lg border transition-all"
                style={
                  demoMode === m
                    ? { background: 'rgba(88,166,255,0.12)', borderColor: 'rgba(88,166,255,0.35)', color: '#58a6ff' }
                    : { background: '#0d1117', borderColor: '#30363d', color: '#8b949e' }
                }
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Mnemonic input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#8b949e]/60">
              Seed Phrase <span className="normal-case tracking-normal">(optional — enables deterministic tokens)</span>
            </div>
            <button
              onClick={() => setShowMnemonic((v) => !v)}
              className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
            >
              {showMnemonic ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <textarea
            rows={3}
            placeholder="word1 word2 word3 … (12, 18, or 24 words)"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            className="w-full text-sm font-mono p-3 rounded-lg border bg-[#0d1117] text-[#c9d1d9] placeholder-[#8b949e]/30 focus:outline-none transition-colors resize-none"
            style={{
              borderColor: !mnemonicOk ? 'rgba(248,81,73,0.5)' : mnemonic ? 'rgba(88,166,255,0.4)' : '#30363d',
              filter: !showMnemonic && mnemonic ? 'blur(4px)' : 'none',
            }}
          />
          <div className="flex items-center justify-between mt-1">
            {!mnemonicOk && (
              <span className="text-[10px] font-mono text-[#f85149]">
                Must be 12, 18, or 24 words (currently {mnemonicWords.length})
              </span>
            )}
            {mnemonicOk && mnemonic && (
              <span className="text-[10px] font-mono text-[#3fb950]">
                {mnemonicWords.length} words ✓
              </span>
            )}
            {!mnemonic && (
              <span className="text-[10px] font-mono text-[#8b949e]/50">
                Leave blank to use random ecash secrets
              </span>
            )}
            <span />
          </div>
          {/* Security note */}
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#d29922]/20 bg-[#d29922]/05 p-3">
            <AlertTriangle size={12} className="text-[#d29922] shrink-0 mt-0.5" />
            <p className="text-[10px] font-mono text-[#d29922]/80 leading-relaxed">
              Seed phrase is held in memory only and never written to storage or transmitted.
              Use a throwaway testnet seed for demos.
            </p>
          </div>
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={loading || !mnemonicOk}
          className="w-full py-2.5 text-sm font-mono rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: 'rgba(88,166,255,0.1)', borderColor: 'rgba(88,166,255,0.3)', color: '#58a6ff' }}
        >
          {loading ? (
            <><Loader size={13} className="animate-spin" /> Connecting…</>
          ) : (
            <><Wallet size={13} /> {status?.connected ? 'Reconnect Wallet' : 'Connect Wallet'}</>
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#f85149]">
            <XCircle size={11} /> {error}
          </div>
        )}

        {/* Per-mint connection status */}
        {status && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-2">
              Mint Connections
            </div>
            <div className="space-y-1.5">
              {Object.entries(status.mintStatuses).map(([url, s]) => {
                const mint = discoveredMints.find((m) => m.url === url);
                const bal  = balances.find((b) => b.mintUrl === url);
                return (
                  <div key={url} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d1117] border border-[#21262d]">
                    {STATUS_ICON[s] ?? STATUS_ICON.idle}
                    <span className="flex-1 text-[11px] font-mono text-[#c9d1d9] truncate">
                      {mint?.name ?? url}
                    </span>
                    {bal && (
                      <span className="text-[10px] font-mono text-[#58a6ff] tabular-nums">
                        {bal.balance.toLocaleString()} sats
                      </span>
                    )}
                    <span
                      className="text-[9px] font-mono capitalize"
                      style={{ color: s === 'connected' ? '#3fb950' : s === 'failed' ? '#f85149' : '#d29922' }}
                    >
                      {s}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Balance summary */}
        {totalBalance > 0 && (
          <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={13} className="text-[#3fb950]" />
              <span className="text-[11px] font-mono text-[#8b949e]">Total balance across all mints</span>
            </div>
            <span className="text-sm font-mono font-bold text-[#c9d1d9] tabular-nums">
              {totalBalance.toLocaleString()} sats
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
