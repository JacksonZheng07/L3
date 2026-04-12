import { useState } from 'react';
import { useStore } from '../../state/store';
import { walletApi } from '../../core/walletApi';
import {
  Send,
  Loader,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';

type SendStep = 'form' | 'sending' | 'done' | 'failed';

export default function SendPanel() {
  const { state, effectiveScores, refreshBalances } = useStore();

  const [invoice, setInvoice] = useState('');
  const [step, setStep] = useState<SendStep>('form');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ paid: boolean; preimage: string | null; usedMints: string[] } | null>(null);

  const totalBalance = state.balances.reduce((s, b) => s + b.balance, 0);
  const canSend = invoice.trim().length > 0 && step === 'form' && totalBalance > 0;

  const isMainnet = state.demoMode === 'mainnet';
  const isMutinynet = state.demoMode === 'mutinynet';

  function unwrapError(res: { ok: false; error: string } | { ok: true }): string {
    return res.ok ? 'unknown error' : res.error;
  }

  async function handleSend() {
    setError(null);
    setStep('sending');
    try {
      const res = await walletApi.smartSend(invoice.trim(), effectiveScores);
      if (!res.ok) {
        setError(unwrapError(res));
        setStep('failed');
        return;
      }
      setResult(res.data);
      refreshBalances();
      setStep('done');
    } catch (e) {
      setError(String(e));
      setStep('failed');
    }
  }

  function handleReset() {
    setStep('form');
    setInvoice('');
    setError(null);
    setResult(null);
  }

  return (
    <div className="bg-[#161b22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <Send size={15} className="text-[#58a6ff]" />
          <span className="text-sm font-mono font-semibold text-[#c9d1d9]">Send Sats</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20">
            LIGHTNING
          </span>
          {isMutinynet && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">
              SIGNET
            </span>
          )}
          {isMainnet && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f0883e]/10 text-[#f0883e] border border-[#f0883e]/20">
              REAL SATS
            </span>
          )}
        </div>
        {step !== 'form' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[10px] font-mono text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
          >
            <RefreshCw size={10} /> New
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* ── Form ── */}
        {step === 'form' && (
          <>
            {/* Balance indicator */}
            <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60">
                  Available balance
                </span>
                <span className="text-sm font-mono font-bold text-[#c9d1d9] tabular-nums">
                  {totalBalance.toLocaleString()} sats
                </span>
              </div>
              {totalBalance === 0 && (
                <p className="text-[9px] font-mono text-[#f85149]/70 mt-1">
                  No funds available. Receive sats first.
                </p>
              )}
            </div>

            {/* Invoice input */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-1.5">
                Lightning Invoice
              </div>
              <textarea
                rows={4}
                placeholder="lnbc... or lntbs..."
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                className="w-full text-xs font-mono p-3 rounded-lg border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] placeholder-[#8b949e]/30 focus:outline-none focus:border-[#58a6ff]/50 transition-colors resize-none"
              />
              <p className="text-[9px] font-mono text-[#8b949e]/50 mt-1">
                Paste a Lightning invoice from any wallet. Funds drain from riskiest mints first.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#f85149]">
                <XCircle size={11} /> {error}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full py-2.5 text-sm font-mono rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: 'rgba(88,166,255,0.1)', borderColor: 'rgba(88,166,255,0.3)', color: '#58a6ff' }}
            >
              <Zap size={13} /> Pay Invoice
            </button>
          </>
        )}

        {/* ── Sending ── */}
        {step === 'sending' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader size={24} className="animate-spin text-[#58a6ff]" />
            <p className="text-sm font-mono text-[#58a6ff]">Paying invoice...</p>
            <p className="text-[10px] font-mono text-[#8b949e]">
              Selecting best mint and melting ecash proofs
            </p>
          </div>
        )}

        {/* ── Done ── */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#3fb950]/25 bg-[#3fb950]/05 p-6 text-center">
              <CheckCircle size={32} className="text-[#3fb950] mx-auto mb-2" />
              <p className="text-sm font-mono font-bold text-[#3fb950]">Payment Sent!</p>
              {result.preimage && (
                <p className="text-[9px] font-mono text-[#8b949e] mt-2 break-all">
                  Preimage: {result.preimage}
                </p>
              )}
              {result.usedMints.length > 0 && (
                <p className="text-[10px] font-mono text-[#8b949e] mt-2">
                  Paid from: {result.usedMints.map((u) => {
                    const score = effectiveScores.find((s) => s.url === u);
                    return score?.name ?? u;
                  }).join(', ')}
                </p>
              )}
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2 text-xs font-mono rounded-lg border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-all"
            >
              Send Again
            </button>
          </div>
        )}

        {/* ── Failed ── */}
        {step === 'failed' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#f85149]/25 bg-[#f85149]/05 p-5 text-center">
              <XCircle size={28} className="text-[#f85149] mx-auto mb-2" />
              <p className="text-sm font-mono font-bold text-[#f85149]">Payment Failed</p>
              {error && (
                <p className="text-[10px] font-mono text-[#f85149]/70 mt-1 break-words">{error}</p>
              )}
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2 text-xs font-mono rounded-lg border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
