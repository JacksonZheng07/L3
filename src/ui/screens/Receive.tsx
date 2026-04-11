import { useState, useEffect, useRef } from 'react';
import { useAppState, useDispatch, getMintList } from '../../state/store';
import { createMintQuote, checkMintQuoteStatus, claimMintedProofs } from '../../core/walletEngine';
import { config } from '../../core/config';
import { InvoiceQR } from '../components/InvoiceQR';

interface Props {
  onBack: () => void;
}

type Step = 'select' | 'amount' | 'qr' | 'success' | 'error';

export function Receive({ onBack }: Props) {
  const state = useAppState();
  const dispatch = useDispatch();
  const mints = getMintList(state);

  const [step, setStep] = useState<Step>('select');
  const [selectedMint, setSelectedMint] = useState('');
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'waiting' | 'paid' | 'timeout'>('waiting');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSelectMint = (mintUrl: string) => {
    setSelectedMint(mintUrl);
    setStep('amount');
  };

  const handleCreateQuote = async () => {
    const sats = parseInt(amount);
    if (!sats || sats <= 0) return;

    try {
      const result = await createMintQuote(selectedMint, sats);
      setInvoice(result.invoice);
      setQuoteId(result.quoteId);
      setStep('qr');
      setPaymentStatus('waiting');

      const startTime = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - startTime > 5 * 60 * 1000) {
          clearInterval(pollRef.current);
          setPaymentStatus('timeout');
          return;
        }

        try {
          const paid = await checkMintQuoteStatus(selectedMint, result.quoteId);
          if (paid) {
            clearInterval(pollRef.current);
            setPaymentStatus('paid');

            const proofs = await claimMintedProofs(selectedMint, sats, result.quoteId);
            dispatch({ type: 'ADD_PROOFS', mintUrl: selectedMint, proofs });
            dispatch({
              type: 'ADD_TRANSACTION',
              tx: {
                id: `tx_${Date.now()}`,
                timestamp: Date.now(),
                type: 'receive',
                mint: selectedMint,
                amount: sats,
                status: 'success',
                invoice: result.invoice,
              },
            });
            dispatch({ type: 'RECORD_TX_RESULT', mintUrl: selectedMint, success: true });
            setStep('success');
          }
        } catch {
          // Polling error, continue
        }
      }, config.ui.pollIntervalMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
      setStep('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white noise">
      <div className="relative max-w-lg mx-auto px-5 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl glass glass-hover flex items-center justify-center transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50"/>
            </svg>
          </button>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Receive</h1>
            <p className="text-[11px] text-white/25 mt-0.5">
              {step === 'select' && 'Choose a mint'}
              {step === 'amount' && 'Enter amount'}
              {step === 'qr' && 'Scan to pay'}
              {step === 'success' && 'Complete'}
              {step === 'error' && 'Something went wrong'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        {(step === 'select' || step === 'amount' || step === 'qr') && (
          <div className="flex gap-1.5 mb-8">
            {['select', 'amount', 'qr'].map((s, i) => (
              <div
                key={s}
                className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                  ['select', 'amount', 'qr'].indexOf(step) >= i
                    ? 'bg-emerald-400/60'
                    : 'bg-white/[0.06]'
                }`}
              />
            ))}
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-3 stagger-children">
            {mints.map(mint => (
              <button
                key={mint.url}
                onClick={() => handleSelectMint(mint.url)}
                className="w-full text-left glass glass-hover rounded-2xl p-4 transition-all duration-200"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      mint.trustScore.grade === 'safe' ? 'bg-emerald-400' :
                      mint.trustScore.grade === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
                    }`} />
                    <div>
                      <div className="font-display font-semibold text-sm text-white/90">{mint.name}</div>
                      <div className="text-[11px] text-white/25 mt-0.5">Trust: {mint.trustScore.score}/100</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-sm font-semibold text-white/70">{mint.balance.toLocaleString()}</div>
                    <div className="text-[10px] text-white/20">sats</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 'amount' && (
          <div className="space-y-5 animate-fade-up">
            <div className="text-center py-4">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-center font-display text-5xl font-bold text-white placeholder:text-white/10 focus:ring-0 focus:shadow-none border-none"
                autoFocus
              />
              <span className="text-sm text-white/25 font-medium">sats</span>
            </div>
            <button
              onClick={handleCreateQuote}
              disabled={!amount || parseInt(amount) <= 0}
              className="btn-primary w-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 disabled:bg-white/[0.03] disabled:text-white/15 disabled:border-white/[0.05] py-3.5 rounded-2xl transition-all"
            >
              Generate Invoice
            </button>
          </div>
        )}

        {step === 'qr' && (
          <div className="space-y-6 animate-fade-up">
            <p className="text-center text-[13px] text-white/30">
              Pay this invoice to receive <span className="text-white/70 font-medium">{parseInt(amount).toLocaleString()} sats</span>
            </p>
            <InvoiceQR invoice={invoice} status={paymentStatus} />
            {paymentStatus === 'timeout' && (
              <button
                onClick={() => { setStep('amount'); setPaymentStatus('waiting'); }}
                className="btn-primary w-full glass glass-hover text-white/60 py-3 rounded-2xl"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="text-center space-y-5 py-12 animate-fade-up">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto glow-green">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-emerald-400">Received!</h2>
              <p className="text-white/30 text-sm mt-1">{parseInt(amount).toLocaleString()} sats added to your wallet</p>
            </div>
            <button
              onClick={onBack}
              className="btn-primary glass glass-hover text-white/60 px-8 py-3 rounded-2xl"
            >
              Back to Home
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center space-y-5 py-12 animate-fade-up">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto glow-red">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-red-400">Error</h2>
              <p className="text-white/30 text-sm mt-1">{error}</p>
              {quoteId && (
                <p className="text-[11px] text-white/15 font-mono mt-2">Quote: {quoteId}</p>
              )}
            </div>
            <button
              onClick={() => { setStep('amount'); setError(''); }}
              className="btn-primary glass glass-hover text-white/60 px-8 py-3 rounded-2xl"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
