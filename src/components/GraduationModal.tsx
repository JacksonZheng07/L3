import { useWallet } from '../context/WalletContext';

export function GraduationModal() {
  const { showGraduation, setShowGraduation, setGraduationDismissed, totalBalance } = useWallet();

  if (!showGraduation) return null;

  const handleDismiss = () => {
    setShowGraduation(false);
    setGraduationDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <span className="text-2xl">&#127942;</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Time to Level Up</h2>
          <p className="text-gray-400 text-sm">
            Your balance has reached <span className="text-amber-400 font-medium">{totalBalance.toLocaleString()} sats</span>.
            It's time to think about self-custody.
          </p>
        </div>

        {/* Trust Spectrum Education */}
        <div className="space-y-4">
          {/* Cashu */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <h3 className="font-semibold text-amber-400 text-sm">Cashu Ecash (Where You Are Now)</h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Think of it like arcade tokens. You gave the arcade (mint) real money, and they gave you
              tokens that work inside their system. If the arcade closes, your tokens are worthless.
              Convenient for small amounts, but you're trusting the mint operator.
            </p>
          </div>

          {/* Ark */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-semibold text-blue-400 text-sm">Ark Self-Custody (Next Step)</h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Like having your own safe that the arcade can't touch. Ark lets you hold Bitcoin
              off-chain with cryptographic guarantees — no mint trust required. If the Ark server
              disappears, you can still recover your funds on-chain.
            </p>
          </div>

          {/* On-Chain */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="font-semibold text-green-400 text-sm">On-Chain (Full Sovereignty)</h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Your own vault. Every satoshi is recorded on the Bitcoin blockchain. Nobody can freeze,
              seize, or counterfeit your coins. This is the endgame — but it costs more to transact.
            </p>
          </div>
        </div>

        {/* Upgrade Button */}
        <button
          disabled
          className="w-full bg-blue-600/30 text-blue-400/50 font-semibold py-3 rounded-xl cursor-not-allowed"
        >
          Upgrade to Self-Custody — Coming Soon (Ark Integration)
        </button>

        <p className="text-gray-600 text-xs text-center">
          We built the UX for graduation. Ark SDK integration is the next milestone.
        </p>

        <button
          onClick={handleDismiss}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl transition-colors text-sm"
        >
          I understand, continue with Cashu
        </button>
      </div>
    </div>
  );
}
