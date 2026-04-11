import { useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { TrustSpectrum } from './TrustSpectrum';

export function Home() {
  const {
    mints,
    transactions,
    totalBalance,
    setCurrentScreen,
    loading,
    error,
    clearError,
    initializeMints,
  } = useWallet();

  useEffect(() => {
    if (mints.length === 0 && !loading) {
      initializeMints();
    }
  }, [mints.length, loading, initializeMints]);

  const usdPrice = totalBalance * 0.001; // rough estimate, ~$100k/BTC

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-lg mx-auto w-full">
      {/* Logo & Title */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-amber-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
            Freedom Wallet
          </span>
        </h1>
        <p className="text-gray-500 text-sm">Bitcoin custody as a journey</p>
      </div>

      {/* Balance */}
      <div className="text-center space-y-1">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-12 w-48 bg-gray-800 rounded-lg mx-auto" />
          </div>
        ) : (
          <>
            <p className="text-5xl font-bold tracking-tight text-white">
              {totalBalance.toLocaleString()}
            </p>
            <p className="text-gray-500 text-lg">
              sats <span className="text-gray-600">~${usdPrice.toFixed(2)}</span>
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex justify-between items-center">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Trust Spectrum */}
      <TrustSpectrum />

      {/* Action Buttons */}
      <div className="flex gap-3 w-full">
        <button
          onClick={() => setCurrentScreen('receive')}
          disabled={loading || mints.length === 0}
          className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-lg"
        >
          Receive
        </button>
        <button
          onClick={() => setCurrentScreen('send')}
          disabled={loading || totalBalance === 0}
          className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-lg"
        >
          Send
        </button>
      </div>

      {/* Transaction History */}
      <div className="w-full">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 border border-gray-700/30"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      tx.type === 'receive'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {tx.type === 'receive' ? '+' : '-'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {tx.type === 'receive' ? 'Received' : 'Sent'}
                    </p>
                    <p className="text-xs text-gray-500">{tx.mintAlias}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      tx.type === 'receive' ? 'text-green-400' : 'text-amber-400'
                    }`}
                  >
                    {tx.type === 'receive' ? '+' : '-'}
                    {tx.amount.toLocaleString()} sats
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
