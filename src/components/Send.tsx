import { useState, useCallback } from 'react';
import { decode } from 'light-bolt11-decoder';
import { useWallet } from '../context/WalletContext';

interface DecodedInvoice {
  amount: number;
  description: string;
  expiry: number;
}

function decodeInvoice(invoice: string): DecodedInvoice | null {
  try {
    const decoded = decode(invoice);
    let amount = 0;
    let description = '';
    let expiry = 3600;

    for (const section of decoded.sections) {
      if (section.name === 'amount') {
        // amount is in millisats
        amount = Math.floor(Number(section.value) / 1000);
      } else if (section.name === 'description') {
        description = String(section.value);
      } else if (section.name === 'expiry') {
        expiry = Number(section.value);
      }
    }

    return { amount, description, expiry };
  } catch {
    return null;
  }
}

export function Send() {
  const { mints, setCurrentScreen, sendFromMint } = useWallet();
  const [selectedMint, setSelectedMint] = useState(0);
  const [invoice, setInvoice] = useState('');
  const [decoded, setDecoded] = useState<DecodedInvoice | null>(null);
  const [step, setStep] = useState<'input' | 'confirm' | 'sending' | 'done' | 'error'>('input');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDecode = useCallback(() => {
    const trimmed = invoice.trim().toLowerCase().replace('lightning:', '');
    const result = decodeInvoice(trimmed);
    if (!result || result.amount <= 0) {
      setErrorMsg('Invalid Lightning invoice');
      return;
    }

    const mint = mints[selectedMint];
    if (!mint || mint.balance < result.amount) {
      setErrorMsg(
        `Insufficient balance on ${mint?.alias ?? 'mint'}. Need ${result.amount} sats, have ${mint?.balance ?? 0}`
      );
      return;
    }

    setDecoded(result);
    setErrorMsg('');
    setStep('confirm');
  }, [invoice, mints, selectedMint]);

  const handleSend = useCallback(async () => {
    setStep('sending');
    try {
      const trimmed = invoice.trim().toLowerCase().replace('lightning:', '');
      await sendFromMint(selectedMint, trimmed);
      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Send failed');
      setStep('error');
    }
  }, [invoice, selectedMint, sendFromMint]);

  const handleBack = useCallback(() => {
    setCurrentScreen('home');
  }, [setCurrentScreen]);

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-lg mx-auto w-full">
      <div className="flex items-center w-full">
        <button
          onClick={handleBack}
          className="text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-white">Send Sats</h1>
        <div className="w-12" />
      </div>

      {step === 'input' && (
        <>
          {/* Mint selector */}
          <div className="w-full space-y-3">
            <label className="text-sm text-gray-400">Send from:</label>
            <div className="flex gap-2">
              {mints.map((mint, i) => (
                <button
                  key={mint.url}
                  onClick={() => setSelectedMint(i)}
                  className={`flex-1 p-3 rounded-xl border transition-colors text-left ${
                    selectedMint === i
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium text-sm">{mint.alias}</p>
                  <p className="text-xs opacity-60">{mint.balance.toLocaleString()} sats</p>
                </button>
              ))}
            </div>
          </div>

          {/* Invoice input */}
          <div className="w-full space-y-2">
            <label className="text-sm text-gray-400">Lightning Invoice:</label>
            <textarea
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="lnbc..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

          <button
            onClick={handleDecode}
            disabled={!invoice.trim()}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors text-lg"
          >
            Decode Invoice
          </button>
        </>
      )}

      {step === 'confirm' && decoded && (
        <>
          <div className="w-full bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 space-y-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">You're sending</p>
              <p className="text-3xl font-bold text-amber-400">{decoded.amount.toLocaleString()} sats</p>
            </div>
            {decoded.description && (
              <div>
                <p className="text-gray-500 text-xs">Description</p>
                <p className="text-gray-300 text-sm">{decoded.description}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 text-xs">From</p>
              <p className="text-gray-300 text-sm">{mints[selectedMint]?.alias}</p>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => { setStep('input'); setDecoded(null); }}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Confirm Send
            </button>
          </div>
        </>
      )}

      {step === 'sending' && (
        <div className="text-center py-8 space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Sending payment...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center space-y-4 py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl text-green-400">&#10003;</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Payment Sent!</h2>
          <p className="text-gray-400">
            <span className="text-amber-400 font-medium">-{decoded?.amount.toLocaleString()} sats</span> from{' '}
            {mints[selectedMint]?.alias}
          </p>
          <button
            onClick={handleBack}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors"
          >
            Back to Home
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center space-y-4 py-8">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl text-red-400">!</span>
          </div>
          <h2 className="text-xl font-bold text-white">Send Failed</h2>
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <button
            onClick={() => { setStep('input'); setErrorMsg(''); }}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
