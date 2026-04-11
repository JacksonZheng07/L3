import { useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '../context/WalletContext';

export function Receive() {
  const { mints, setCurrentScreen, receiveToMint, pollForPayment } = useWallet();
  const [selectedMint, setSelectedMint] = useState(0);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'select' | 'waiting' | 'done' | 'error'>('select');
  const [invoice, setInvoice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const handleGenerate = useCallback(async () => {
    const sats = parseInt(amount);
    if (!sats || sats <= 0) {
      setErrorMsg('Enter a valid amount');
      return;
    }
    try {
      setStep('waiting');
      const result = await receiveToMint(selectedMint, sats);
      setInvoice(result.invoice);

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const paid = await pollForPayment(selectedMint, result.quote, sats);
          if (paid) {
            clearInterval(pollingRef.current);
            setStep('done');
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create invoice');
      setStep('error');
    }
  }, [amount, selectedMint, receiveToMint, pollForPayment]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(invoice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [invoice]);

  const handleBack = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
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
        <h1 className="flex-1 text-center text-xl font-bold text-white">Receive Sats</h1>
        <div className="w-12" />
      </div>

      {step === 'select' && (
        <>
          {/* Mint selector */}
          <div className="w-full space-y-3">
            <label className="text-sm text-gray-400">Receive into:</label>
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

          {/* Amount input */}
          <div className="w-full space-y-2">
            <label className="text-sm text-gray-400">Amount (sats):</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              min="1"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {errorMsg && (
            <p className="text-red-400 text-sm">{errorMsg}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={!amount || parseInt(amount) <= 0}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors text-lg"
          >
            Generate Invoice
          </button>
        </>
      )}

      {step === 'waiting' && invoice && (
        <>
          <div className="bg-white p-4 rounded-2xl">
            <QRCodeSVG value={invoice} size={240} />
          </div>
          <p className="text-gray-400 text-sm text-center">
            Scan or copy this Lightning invoice to send <span className="text-white font-medium">{amount} sats</span> to{' '}
            <span className="text-amber-400">{mints[selectedMint]?.alias}</span>
          </p>

          <div className="w-full bg-gray-800 rounded-xl p-3 relative">
            <p className="text-xs text-gray-400 font-mono break-all pr-16">
              {invoice}
            </p>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-amber-400">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm">Waiting for payment...</span>
          </div>
        </>
      )}

      {step === 'done' && (
        <div className="text-center space-y-4 py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl text-green-400">&#10003;</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Payment Received!</h2>
          <p className="text-gray-400">
            <span className="text-green-400 font-medium">+{amount} sats</span> added to{' '}
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
          <h2 className="text-xl font-bold text-white">Something went wrong</h2>
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <button
            onClick={() => { setStep('select'); setErrorMsg(''); }}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
