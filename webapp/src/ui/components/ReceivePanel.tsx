import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import { walletEngine } from '../../core/walletEngine';
import { gradeColor } from '../../lib/theme';
import { QRCodeSVG } from 'qrcode.react';
import {
  Download,
  Copy,
  Check,
  Loader,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  ShieldCheck,
} from 'lucide-react';

type ReceiveStep = 'form' | 'waiting' | 'done' | 'failed';

const QUICK_AMOUNTS = [100, 500, 1_000, 5_000, 10_000];

export default function ReceivePanel() {
  const { state, effectiveScores, refreshBalances } = useStore();

  const [amountStr, setAmountStr] = useState('');
  const [step, setStep]           = useState<ReceiveStep>('form');
  const [invoice, setInvoice]     = useState('');
  const [_quoteId, setQuoteId]    = useState('');
  const [mintUrl, setMintUrl]     = useState('');
  const [credited, setCredited]   = useState(0);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(false);

  // Stop polling on unmount
  useEffect(() => () => { pollRef.current = false; }, []);

  const amount = parseInt(amountStr.replace(/,/g, ''), 10);
  const canGenerate = !isNaN(amount) && amount > 0 && step === 'form' && !generating;

  // Find the best mint that would be auto-selected
  const bestMint = effectiveScores
    .filter((s) => s.isOnline && s.grade !== 'critical')
    .sort((a, b) => b.compositeScore - a.compositeScore)[0] ?? null;

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const result = await walletEngine.smartReceive(amount, effectiveScores);
      if (!result.ok) {
        setError(result.error);
        setGenerating(false);
        return;
      }
      setInvoice(result.data.request);
      setQuoteId(result.data.quote);
      setMintUrl(result.data.mintUrl);
      setStep('waiting');
      setGenerating(false);

      // Auto-start polling immediately
      startPolling(result.data.mintUrl, result.data.quote);
    } catch (e) {
      setError(String(e));
      setGenerating(false);
    }
  }

  function startPolling(url: string, quote: string) {
    pollRef.current = true;
    (async () => {
      try {
        const result = await walletEngine.pollMintQuote(url, quote);
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
    })();
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
    setMintUrl('');
    setCredited(0);
    setError(null);
    setGenerating(false);
    pollRef.current = false;
  }

  const selectedMintScore = effectiveScores.find((s) => s.url === mintUrl);
  const isMainnet = state.demoMode === 'mainnet';
  const isMutinynet = state.demoMode === 'mutinynet';


  return (
    <div className="bg-[#161b22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-[#3fb950]" />
          <span className="text-sm font-mono font-semibold text-[#c9d1d9]">Receive Sats</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20">
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
        {/* ── Step 1: Form ── */}
        {step === 'form' && (
          <>
            {/* Auto-selected mint indicator */}
            {bestMint && (
              <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={12} className="text-[#3fb950]" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60">
                    Auto-selected mint
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#c9d1d9] font-semibold">{bestMint.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: gradeColor(bestMint.grade) }} />
                    <span className="text-[9px] font-mono" style={{ color: gradeColor(bestMint.grade) }}>
                      {bestMint.grade.toUpperCase()} · {bestMint.compositeScore.toFixed(0)}
                    </span>
                  </div>
                </div>
                <p className="text-[9px] font-mono text-[#8b949e]/60 mt-1">
                  Highest-trust online mint. Funds will be rebalanced automatically.
                </p>
              </div>
            )}

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
              {generating ? (
                <><Loader size={13} className="animate-spin" /> Generating...</>
              ) : (
                <><Zap size={13} /> Generate Invoice</>
              )}
            </button>
          </>
        )}

        {/* ── Step 2: QR Code + Waiting ── */}
        {step === 'waiting' && (
          <>
            {/* QR Code - big and scannable */}
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={invoice.toUpperCase()}
                  size={240}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-[11px] font-mono text-[#3fb950] mt-3 font-semibold">
                Scan with any Lightning wallet
              </p>
              <p className="text-[10px] font-mono text-[#8b949e] mt-1">
                Phoenix, Strike, Cash App, Zeus, Alby, etc.
              </p>
            </div>

            {/* Amount + mint info */}
            <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                <span>Amount</span>
                <span className="text-[#c9d1d9] tabular-nums font-bold text-sm">{amount.toLocaleString()} sats</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                <span>Mint</span>
                <div className="flex items-center gap-1.5">
                  {selectedMintScore && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: gradeColor(selectedMintScore.grade) }} />
                  )}
                  <span className="text-[#c9d1d9]">{selectedMintScore?.name ?? mintUrl}</span>
                </div>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                <span>Network</span>
                <span className={isMainnet ? 'text-[#f0883e]' : isMutinynet ? 'text-[#a855f7]' : 'text-[#d29922]'}>
                  {isMainnet ? 'Bitcoin Mainnet' : isMutinynet ? 'Mutinynet Signet' : 'Testnet'}
                </span>
              </div>
            </div>

            {/* Copy invoice */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-mono rounded-lg border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-all"
            >
              {copied ? (
                <><Check size={11} className="text-[#3fb950]" /> Copied!</>
              ) : (
                <><Copy size={11} /> Copy Invoice</>
              )}
            </button>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 py-2 text-sm font-mono text-[#d29922]">
              <Loader size={14} className="animate-spin" />
              Waiting for payment...
            </div>

            {/* Raw invoice (collapsed) */}
            <details className="group">
              <summary className="text-[9px] font-mono text-[#8b949e]/50 cursor-pointer hover:text-[#8b949e] transition-colors">
                Show raw invoice
              </summary>
              <p className="text-[9px] font-mono text-[#8b949e]/60 break-all mt-2 leading-relaxed bg-[#0d1117] rounded p-2 border border-[#21262d]">
                {invoice}
              </p>
            </details>

            {error && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#f85149]">
                <XCircle size={11} /> {error}
              </div>
            )}
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#3fb950]/25 bg-[#3fb950]/05 p-6 text-center">
              <CheckCircle size={32} className="text-[#3fb950] mx-auto mb-2" />
              <p className="text-sm font-mono font-bold text-[#3fb950]">Payment Received!</p>
              <p className="text-3xl font-mono font-black text-[#c9d1d9] mt-2 tabular-nums">
                +{credited.toLocaleString()}
                <span className="text-sm font-normal text-[#8b949e] ml-1.5">sats</span>
              </p>
              <p className="text-[10px] font-mono text-[#8b949e] mt-3">
                Ecash tokens minted on{' '}
                <span className="text-[#c9d1d9] font-semibold">{selectedMintScore?.name ?? mintUrl}</span>
              </p>
              <p className="text-[9px] font-mono text-[#8b949e]/60 mt-1">
                Funds will be distributed across trusted mints automatically.
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
