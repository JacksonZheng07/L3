import { useWallet } from '../context/WalletContext';

export function About() {
  const { setCurrentScreen } = useWallet();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
      <div className="flex items-center w-full">
        <button
          onClick={() => setCurrentScreen('home')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-white">About</h1>
        <div className="w-12" />
      </div>

      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
            Freedom Wallet
          </h2>
          <p className="text-gray-400 text-sm italic">
            "Bitcoin custody should be a journey, not a decision you make on day one and never revisit."
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-white">The Problem</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            4 billion people are unbanked. Bitcoin can help, but Lightning Network requires an
            on-chain channel open costing $5-10+ when fees spike. That's more than many people earn in a day.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Cashu ecash solves onboarding cost (zero fees, instant), but introduces mint trust.
            Every existing Cashu wallet hides this tradeoff.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-white">Our Solution</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Start users with zero-friction ecash, make the trust tradeoff visible and measurable,
            split funds across mints to limit risk, and build the UX rails for graduating to
            self-custody via Ark.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-white">How It Works</h3>
          <ul className="text-gray-400 text-sm space-y-2">
            <li className="flex gap-2">
              <span className="text-amber-400">1.</span>
              Receive sats via Lightning into Cashu ecash tokens
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">2.</span>
              Funds split across multiple mints to limit risk
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">3.</span>
              Real-time trust scoring of each mint
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">4.</span>
              Visual trust spectrum shows where your money sits
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">5.</span>
              Graduation nudge when balance grows
            </li>
          </ul>
        </div>

        <div className="text-center text-gray-600 text-xs space-y-1">
          <p>Built for MIT Bitcoin Hackathon 2026</p>
          <p>Running on MutinyNet (testnet)</p>
        </div>
      </div>
    </div>
  );
}
