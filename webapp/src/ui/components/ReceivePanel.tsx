import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import { walletEngine } from '../../core/walletEngine';
import { gradeColor } from '../../lib/theme';
import {
  Download,
  Copy,
  Check,
  Loader,
  CheckCircle,
  XCircle,
  ChevronDown,
  RefreshCw,
  Zap,
} from 'lucide-react';

type ReceiveStep = 'form' | 'invoice' | 'polling' | 'done' | 'failed';

const QUICK_AMOUNTS = [100, 500, 1_000, 5_000, 10_000];

export default function ReceivePanel() {
  const { state, effectiveScores, refreshBalances } = useStore();
  const { balances, demoMode, discoveredMints } = state;

  const [mintUrl, setMintUrl]     = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [step, setStep]           = useState<ReceiveStep>('form');
  const [invoice, setInvoice]     = useState('');
  const [quoteId, setQuoteId]     = useState('');
  const [credited, setCredited]   = useState(0);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const pollRef = useRef(false);

  // Stop polling on unmount
  useEffect(() => () => { pollRef.current = false; }, []);

  const amount = parseInt(amountStr.replace(/,/g, ''), 10);
  const canGenerate = mintUrl && !isNaN(amount) && amount > 0 && step === 'form';

  // All known mints (even with zero balance) as receive targets
  const mintOptions = effectiveScores.length > 0
    ? effectiveScores
    : discoveredMints.map((m) => ({ url: m.url, name: m.name, grade: 'warning' as const, compositeScore: 0, isOnline: false }));

  async function handleGenerate() {
    setError(null);
    const result = await walletEngine.receive(mintUrl, amount);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInvoice(result.data.request);
    setQuoteId(result.data.quote);
    setStep('invoice');
  }

  async function handlePoll() {
    setStep('polling');
    pollRef.current = true;
    try {
      const result = await walletEngine.pollMintQuote(mintUrl, quoteId);
      if (!pollRef.current) return;
      if (result.ok) {
        const sum = result.data.reduce((s, p) => s + p.amount, 0);
        setCredited(sum);
        refreshBalances();
        setStep('done');
      } else {
        setError(result.error);
        setStep('failed');
      }
    } catch (e) {
      if (pollRef.current) {
        setError(String(e));
        setStep('failed');
      }
    } finally {
      pollRef.current = false;
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(invoice).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    setStep('form');
    setInvoice('');
    setQuoteId('');
    setCredited(0);
    setError(null);
    pollRef.current = false;
  }

  const mintForUrl = (url: string) =>
    mintOptions.find((m) => m.url === url) ?? null;

  return (
    <div
      className="bg-[#161b22] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-[#3fb950]" />
          <span className="text-sm font-mono font-semibold text-[#c9d1d9]">Receive Sats</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20">
            LIGHTNING
          </span>
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
        {/* ── Step 1: Form ── */}
        {step === 'form' && (
          <>
            {/* Mint selector */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-1.5">
                Receive into mint
              </div>
              <div className="relative">
                <select
                  value={mintUrl}
                  onChange={(e) => setMintUrl(e.target.value)}
                  className="w-full appearance-none text-xs font-mono pl-3 pr-8 py-2 rounded-lg border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] focus:outline-none focus:border-[#3fb950]/50 transition-colors"
                >
                  <option value="">Select mint…</option>
                  {mintOptions.map((m) => {
                    const bal = balances.find((b) => b.mintUrl === m.url);
                    return (
                      <option key={m.url} value={m.url}>
                        {m.name}{bal ? ` — ${bal.balance.toLocaleString()} sats` : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
              </div>
              {mintUrl && (() => {
                const m = mintForUrl(mintUrl);
                if (!m || !('grade' in m) || !m.grade) return null;
                const color = gradeColor(m.grade as 'safe' | 'warning' | 'critical');
                return (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-mono" style={{ color }}>
                      {(m.grade as string).toUpperCase()}
                      {'compositeScore' in m && m.compositeScore ? ` · ${(m.compositeScore as number).toFixed(0)}` : ''}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Amount */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-1.5">
                Amount
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/[^\d,]/g, ''))}
                  className="w-full text-sm font-mono pl-3 pr-14 py-2 rounded-lg border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] placeholder-[#8b949e]/30 focus:outline-none focus:border-[#3fb950]/50 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#8b949e]/60 pointer-events-none">
                  sats
                </span>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmountStr(v.toLocaleString())}
                    className="text-[10px] font-mono px-2 py-1 rounded border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-all"
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#f85149]">
                <XCircle size={11} /> {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full py-2.5 text-sm font-mono rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: 'rgba(63,185,80,0.1)', borderColor: 'rgba(63,185,80,0.3)', color: '#3fb950' }}
            >
              <Zap size={13} /> Generate Invoice
            </button>
          </>
        )}

        {/* ── Step 2: Invoice ready ── */}
        {(step === 'invoice' || step === 'polling') && (
          <>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-1.5">
                Lightning Invoice
              </div>
              <div className="relative rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
                <p className="text-[10px] font-mono text-[#8b949e] break-all pr-8 leading-relaxed">
                  {invoice}
                </p>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-1.5 rounded border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                >
                  {copied ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
                </button>
              </div>
              <p className="text-[10px] font-mono text-[#8b949e]/60 mt-1.5">
                {demoMode === 'mock'
                  ? 'Mock mode — click "Simulate Payment" below to instantly credit your wallet.'
                  : 'Pay this invoice from any Lightning wallet to receive the ecash tokens.'}
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-3 space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                <span>Amount</span>
                <span className="text-[#c9d1d9] tabular-nums font-semibold">{amount.toLocaleString()} sats</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                <span>Mint</span>
                <span className="text-[#c9d1d9]">{mintForUrl(mintUrl)?.name ?? mintUrl}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#f85149]">
                <XCircle size={11} /> {error}
              </div>
            )}

            {step === 'invoice' && (
              <button
                onClick={handlePoll}
                className="w-full py-2.5 text-sm font-mono rounded-lg border transition-all flex items-center justify-center gap-2"
                style={{ background: 'rgba(88,166,255,0.1)', borderColor: 'rgba(88,166,255,0.3)', color: '#58a6ff' }}
              >
                <Zap size={13} />
                {demoMode === 'mock' ? 'Simulate Payment' : 'Check Payment Status'}
              </button>
            )}

            {step === 'polling' && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm font-mono text-[#d29922]">
                <Loader size={14} className="animate-spin" />
                {demoMode === 'mock' ? 'Minting tokens…' : 'Waiting for payment…'}
              </div>
            )}
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#3fb950]/25 bg-[#3fb950]/05 p-5 text-center">
              <CheckCircle size={28} className="text-[#3fb950] mx-auto mb-2" />
              <p className="text-sm font-mono font-bold text-[#3fb950]">Payment Received!</p>
              <p className="text-2xl font-mono font-black text-[#c9d1d9] mt-1 tabular-nums">
                +{credited.toLocaleString()}
                <span className="text-sm font-normal text-[#8b949e] ml-1.5">sats</span>
              </p>
              <p className="text-[10px] font-mono text-[#8b949e] mt-2">
                Ecash tokens minted on{' '}
                <span className="text-[#c9d1d9]">{mintForUrl(mintUrl)?.name ?? mintUrl}</span>
              </p>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2 text-xs font-mono rounded-lg border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-all"
            >
              Receive Again
            </button>
          </div>
        )}

        {/* ── Step 4: Failed ── */}
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
