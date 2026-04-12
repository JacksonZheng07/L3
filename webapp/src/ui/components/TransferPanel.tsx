import { useState } from 'react';
import { useStore } from '../../state/store';
import { gradeColor } from '../../lib/theme';
import type { MigrationEvent } from '../../state/types';
import {
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Loader,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';

type TransferStatus = 'idle' | 'pending' | 'success' | 'failed';

const QUICK_AMOUNTS = [
  { label: '100', value: 100 },
  { label: '500', value: 500 },
  { label: '1k', value: 1_000 },
  { label: '10k', value: 10_000 },
  { label: 'Max', value: -1 }, // sentinel: use full source balance
];

export default function TransferPanel() {
  const { state, effectiveScores, manualTransfer } = useStore();
  const { balances } = state;

  const [fromUrl, setFromUrl] = useState('');
  const [toUrl, setToUrl]   = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [txStatus, setTxStatus] = useState<TransferStatus>('idle');
  const [txEvent, setTxEvent]   = useState<MigrationEvent | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // Mints that have funds available
  const fundedMints = balances.filter((b) => b.balance > 0);

  function sourceBalance(): number {
    return balances.find((b) => b.mintUrl === fromUrl)?.balance ?? 0;
  }

  function parsedAmount(): number {
    return parseInt(amountStr.replace(/,/g, ''), 10);
  }

  function handleQuick(value: number) {
    if (value === -1) {
      setAmountStr(sourceBalance().toLocaleString());
    } else {
      setAmountStr(value.toLocaleString());
    }
  }

  function scoreFor(url: string) {
    return effectiveScores.find((s) => s.url === url);
  }

  async function handleTransfer() {
    const amount = parsedAmount();
    if (!fromUrl || !toUrl || isNaN(amount) || amount <= 0) return;
    if (fromUrl === toUrl) { setError('Source and destination must differ.'); return; }
    if (amount > sourceBalance()) { setError(`Insufficient balance (${sourceBalance().toLocaleString()} sats available).`); return; }

    setError(null);
    setTxStatus('pending');
    setTxEvent(null);

    try {
      const event = await manualTransfer(fromUrl, toUrl, amount);
      if (event && event.status === 'completed') {
        setTxStatus('success');
        setTxEvent(event);
        setAmountStr('');
      } else {
        setTxStatus('failed');
        setTxEvent(event);
      }
    } catch (e) {
      setTxStatus('failed');
      setError(String(e));
    }
  }

  const canTransfer =
    fromUrl && toUrl && fromUrl !== toUrl && !isNaN(parsedAmount()) && parsedAmount() > 0 && txStatus !== 'pending';

  return (
    <div
      className="bg-[#161b22] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#21262d]">
        <ArrowRightLeft size={15} className="text-[#a855f7]" />
        <span className="text-sm font-mono font-semibold text-[#c9d1d9]">Transfer Tokens</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">
          MANUAL
        </span>
      </div>

      <div className="p-5 space-y-5">
        {fundedMints.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#30363d] p-6 text-center">
            <p className="text-xs font-mono text-[#8b949e]">
              No funded mints — connect your wallet and ensure you have a balance.
            </p>
          </div>
        ) : (
          <>
            {/* Source / destination row */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              {/* From */}
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-1.5">From</div>
                <div className="relative">
                  <select
                    value={fromUrl}
                    onChange={(e) => { setFromUrl(e.target.value); setTxStatus('idle'); }}
                    className="w-full appearance-none text-xs font-mono pl-3 pr-8 py-2 rounded-lg border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] focus:outline-none focus:border-[#a855f7]/50 transition-colors"
                  >
                    <option value="">Select source…</option>
                    {fundedMints.map((b) => (
                      <option key={b.mintUrl} value={b.mintUrl}>
                        {b.mintName} — {b.balance.toLocaleString()} sats
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
                </div>
                {fromUrl && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {(() => {
                      const s = scoreFor(fromUrl);
                      if (!s) return null;
                      const color = gradeColor(s.grade);
                      return (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[9px] font-mono" style={{ color }}>
                            {s.grade.toUpperCase()} · {s.compositeScore.toFixed(0)}
                          </span>
                        </>
                      );
                    })()}
                    <span className="text-[9px] font-mono text-[#8b949e] ml-auto">
                      {sourceBalance().toLocaleString()} sats avail.
                    </span>
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center mt-4">
                <div
                  className="p-2 rounded-full border"
                  style={{ borderColor: '#30363d', background: '#21262d' }}
                >
                  <ArrowRight size={14} className="text-[#8b949e]" />
                </div>
              </div>

              {/* To */}
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-1.5">To</div>
                <div className="relative">
                  <select
                    value={toUrl}
                    onChange={(e) => { setToUrl(e.target.value); setTxStatus('idle'); }}
                    className="w-full appearance-none text-xs font-mono pl-3 pr-8 py-2 rounded-lg border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] focus:outline-none focus:border-[#a855f7]/50 transition-colors"
                  >
                    <option value="">Select destination…</option>
                    {effectiveScores
                      .filter((s) => s.url !== fromUrl)
                      .map((s) => {
                        return (
                          <option key={s.url} value={s.url}>
                            {s.name} · {s.grade.toUpperCase()} ({s.compositeScore.toFixed(0)})
                          </option>
                        );
                      })}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] pointer-events-none" />
                </div>
                {toUrl && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {(() => {
                      const s = scoreFor(toUrl);
                      if (!s) return null;
                      const color = gradeColor(s.grade);
                      const destBal = balances.find((b) => b.mintUrl === toUrl)?.balance ?? 0;
                      return (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[9px] font-mono" style={{ color }}>
                            {s.grade.toUpperCase()} · {s.compositeScore.toFixed(0)}
                          </span>
                          <span className="text-[9px] font-mono text-[#8b949e] ml-auto">
                            {destBal.toLocaleString()} sats
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Amount */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b949e]/60 mb-1.5">Amount</div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={amountStr}
                    onChange={(e) => {
                      setAmountStr(e.target.value.replace(/[^\d,]/g, ''));
                      setTxStatus('idle');
                    }}
                    className="w-full text-sm font-mono pl-3 pr-14 py-2 rounded-lg border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] placeholder-[#8b949e]/30 focus:outline-none focus:border-[#a855f7]/50 transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#8b949e]/60 pointer-events-none">
                    sats
                  </span>
                </div>
                <div className="flex gap-1">
                  {QUICK_AMOUNTS.map(({ label, value }) => (
                    <button
                      key={label}
                      onClick={() => handleQuick(value)}
                      disabled={!fromUrl}
                      className="text-[10px] font-mono px-2 py-1.5 rounded-lg border border-[#30363d] bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-all disabled:opacity-30"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Transfer preview */}
            {fromUrl && toUrl && parsedAmount() > 0 && (
              <div className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-3 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                  <span>Transfer</span>
                  <span className="text-[#c9d1d9] font-semibold tabular-nums">{parsedAmount().toLocaleString()} sats</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                  <span>From</span>
                  <span className="text-[#c9d1d9]">{effectiveScores.find((s) => s.url === fromUrl)?.name ?? fromUrl}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                  <span>To</span>
                  <span className="text-[#c9d1d9]">{effectiveScores.find((s) => s.url === toUrl)?.name ?? toUrl}</span>
                </div>
                {state.demoMode !== 'mock' && (
                  <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                    <span>Network fees</span>
                    <span className="text-[#d29922]">~1–3 sats (Lightning routing)</span>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#f85149]">
                <XCircle size={11} /> {error}
              </div>
            )}

            {/* Transfer button */}
            <button
              onClick={handleTransfer}
              disabled={!canTransfer}
              className="w-full py-2.5 text-sm font-mono rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={
                txStatus === 'success'
                  ? { background: 'rgba(63,185,80,0.12)', borderColor: 'rgba(63,185,80,0.35)', color: '#3fb950' }
                  : txStatus === 'failed'
                  ? { background: 'rgba(248,81,73,0.12)', borderColor: 'rgba(248,81,73,0.35)', color: '#f85149' }
                  : { background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.3)', color: '#a855f7' }
              }
            >
              {txStatus === 'pending' && <><Loader size={13} className="animate-spin" /> Transferring…</>}
              {txStatus === 'success' && <><CheckCircle size={13} /> Transfer Complete</>}
              {txStatus === 'failed'  && <><XCircle size={13} /> Transfer Failed — Retry</>}
              {txStatus === 'idle'    && <><ArrowRightLeft size={13} /> Transfer</>}
            </button>

            {/* Success event */}
            {txStatus === 'success' && txEvent && (
              <div className="rounded-lg border border-[#3fb950]/20 bg-[#3fb950]/05 px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#3fb950] font-semibold mb-1">
                  <CheckCircle size={12} /> Transfer confirmed
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                  <span>Amount</span>
                  <span className="text-[#3fb950] tabular-nums">{txEvent.amount.toLocaleString()} sats</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                  <span>From → To</span>
                  <span className="text-[#c9d1d9]">{txEvent.fromMint} → {txEvent.toMint}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#8b949e]">
                  <span>Time</span>
                  <span className="text-[#c9d1d9]">{new Date(txEvent.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
