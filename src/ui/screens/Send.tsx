import { useState } from 'react';
import { useAppState, useDispatch, getMintList } from '../../state/store';
import { meltTokens } from '../../core/walletEngine';
import { decode as decodeBolt11 } from 'light-bolt11-decoder';

interface Props {
  onBack: () => void;
}

type Step = 'paste' | 'confirm' | 'sending' | 'success' | 'error';

interface DecodedInvoice {
  amount: number;
  description: string;
  expiry: number;
}

function decodeInvoice(invoice: string): DecodedInvoice | null {
  try {
    const decoded = decodeBolt11(invoice);
    let amount = 0;
    let description = '';
    let expiry = 0;

    for (const section of decoded.sections) {
      if (section.name === 'amount') {
        amount = Math.floor(Number(section.value) / 1000);
      }
      if (section.name === 'description') {
        description = String(section.value);
      }
      if (section.name === 'expiry') {
        expiry = Number(section.value);
      }
    }

    return { amount, description, expiry };
  } catch {
    return null;
  }
}

export function Send({ onBack }: Props) {
  const state = useAppState();
  const dispatch = useDispatch();
  const mints = getMintList(state);

  const [step, setStep] = useState<Step>('paste');
  const [invoiceStr, setInvoiceStr] = useState('');
  const [decoded, setDecoded] = useState<DecodedInvoice | null>(null);
  const [selectedMint, setSelectedMint] = useState('');
  const [error, setError] = useState('');

  const handleDecode = () => {
    const result = decodeInvoice(invoiceStr.trim());
    if (!result || result.amount <= 0) {
      setError('Invalid Lightning invoice');
      return;
    }
    setDecoded(result);
    setStep('confirm');
  };

  const handleSend = async () => {
    if (!selectedMint || !decoded) return;

    const mint = state.mints[selectedMint];
    if (!mint || mint.balance < decoded.amount) {
      setError('Insufficient balance on this mint');
      return;
    }

    setStep('sending');

    try {
      const result = await meltTokens(selectedMint, mint.proofs, invoiceStr.trim());

      if (result.paid) {
        dispatch({ type: 'SET_PROOFS', mintUrl: selectedMint, proofs: result.change });
        dispatch({
          type: 'ADD_TRANSACTION',
          tx: {
            id: `tx_${Date.now()}`,
            timestamp: Date.now(),
            type: 'send',
            mint: selectedMint,
            amount: decoded.amount,
            status: 'success',
            invoice: invoiceStr.trim(),
          },
        });
        dispatch({ type: 'RECORD_TX_RESULT', mintUrl: selectedMint, success: true });
        setStep('success');
      } else {
        dispatch({ type: 'RECORD_TX_RESULT', mintUrl: selectedMint, success: false });
        setError('Payment failed \u2014 invoice was not paid');
        setStep('error');
      }
    } catch (err) {
      dispatch({ type: 'RECORD_TX_RESULT', mintUrl: selectedMint, success: false });
      setError(err instanceof Error ? err.message : 'Send failed');
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
            <h1 className="font-display text-xl font-bold tracking-tight">Send</h1>
            <p className="text-[11px] text-white/25 mt-0.5">
              {step === 'paste' && 'Paste a Lightning invoice'}
              {step === 'confirm' && 'Confirm details'}
              {step === 'sending' && 'Processing...'}
              {step === 'success' && 'Complete'}
              {step === 'error' && 'Something went wrong'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        {(step === 'paste' || step === 'confirm') && (
          <div className="flex gap-1.5 mb-8">
            {['paste', 'confirm'].map((s, i) => (
              <div
                key={s}
                className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                  ['paste', 'confirm'].indexOf(step) >= i
                    ? 'bg-orange-400/60'
                    : 'bg-white/[0.06]'
                }`}
              />
            ))}
          </div>
        )}

        {step === 'paste' && (
          <div className="space-y-5 animate-fade-up">
            <textarea
              value={invoiceStr}
              onChange={e => setInvoiceStr(e.target.value)}
              placeholder="lnbc..."
              rows={4}
              className="w-full glass rounded-2xl px-4 py-4 text-[13px] text-white/80 font-mono placeholder:text-white/15 resize-none border border-white/[0.06] focus:border-amber-500/30"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-[12px] flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-red-400" />
                {error}
              </p>
            )}
            <button
              onClick={handleDecode}
              disabled={!invoiceStr.trim()}
              className="btn-primary w-full bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/20 hover:border-orange-500/30 disabled:bg-white/[0.03] disabled:text-white/15 disabled:border-white/[0.05] py-3.5 rounded-2xl transition-all"
            >
              Decode Invoice
            </button>
          </div>
        )}

        {step === 'confirm' && decoded && (
          <div className="space-y-5 animate-fade-up">
            {/* Invoice summary */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[12px] text-white/30">Amount</span>
                <span className="font-display text-xl font-bold text-white">{decoded.amount.toLocaleString()} <span className="text-sm text-white/25">sats</span></span>
              </div>
              {decoded.description && (
                <>
                  <div className="h-px bg-white/[0.04]" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-[12px] text-white/30">Description</span>
                    <span className="text-[13px] text-white/50 text-right max-w-[200px]">{decoded.description}</span>
                  </div>
                </>
              )}
            </div>

            {/* Mint selection */}
            <div>
              <p className="text-[12px] text-white/30 mb-3 px-1">Send from</p>
              <div className="space-y-2">
                {mints.map(mint => {
                  const insufficient = mint.balance < decoded.amount;
                  const isSelected = selectedMint === mint.url;
                  return (
                    <button
                      key={mint.url}
                      onClick={() => setSelectedMint(mint.url)}
                      disabled={insufficient}
                      className={`w-full text-left rounded-2xl p-4 transition-all duration-200 ${
                        isSelected
                          ? 'glass-elevated border-orange-500/30 glow-amber'
                          : insufficient
                          ? 'glass opacity-40 cursor-not-allowed'
                          : 'glass glass-hover'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-orange-400' : 'border-white/15'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-orange-400" />}
                          </div>
                          <span className="font-display font-semibold text-sm">{mint.name}</span>
                        </div>
                        <span className={`text-sm font-medium ${insufficient ? 'text-red-400/60' : 'text-white/50'}`}>
                          {mint.balance.toLocaleString()} sats
                        </span>
                      </div>
                      {insufficient && (
                        <span className="text-[11px] text-red-400/50 ml-9 mt-1 block">Insufficient balance</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-[12px] flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-red-400" />
                {error}
              </p>
            )}

            <button
              onClick={handleSend}
              disabled={!selectedMint}
              className="btn-primary w-full bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/20 hover:border-orange-500/30 disabled:bg-white/[0.03] disabled:text-white/15 disabled:border-white/[0.05] py-3.5 rounded-2xl transition-all"
            >
              Confirm Send
            </button>
          </div>
        )}

        {step === 'sending' && (
          <div className="text-center py-16 space-y-5 animate-fade-up">
            <div className="relative w-12 h-12 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-orange-400/20" />
              <div className="absolute inset-0 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            </div>
            <p className="text-[13px] text-white/30">Sending payment...</p>
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
              <h2 className="font-display text-xl font-bold text-emerald-400">Sent!</h2>
              <p className="text-white/30 text-sm mt-1">{decoded?.amount.toLocaleString()} sats sent successfully</p>
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
              <h2 className="font-display text-xl font-bold text-red-400">Send Failed</h2>
              <p className="text-white/30 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => { setStep('confirm'); setError(''); }}
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
