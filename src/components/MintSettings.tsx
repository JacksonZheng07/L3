import { useWallet } from '../context/WalletContext';
import { getTrustLabel } from '../lib/trustScore';

export function MintSettings() {
  const { mints, setCurrentScreen } = useWallet();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
      <div className="flex items-center w-full">
        <button
          onClick={() => setCurrentScreen('home')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-white">Mint Settings</h1>
        <div className="w-12" />
      </div>

      {mints.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No mints connected</p>
      ) : (
        <div className="space-y-4">
          {mints.map((mint) => {
            const trust = getTrustLabel(mint.trustScore.totalScore);
            return (
              <div
                key={mint.url}
                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-white text-lg">{mint.alias}</h2>
                    <p className="text-xs text-gray-500 font-mono break-all">{mint.url}</p>
                  </div>
                  <span
                    className="text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: trust.color + '20',
                      color: trust.color,
                    }}
                  >
                    {trust.label}
                  </span>
                </div>

                {/* Info */}
                {mint.info && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Name</p>
                      <p className="text-gray-300">{mint.info.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Version</p>
                      <p className="text-gray-300">{mint.info.version}</p>
                    </div>
                    {mint.info.description && (
                      <div className="col-span-2">
                        <p className="text-gray-500 text-xs">Description</p>
                        <p className="text-gray-300">{mint.info.description}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className="text-sm font-bold text-white">{mint.balance.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">sats</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Trust Score</p>
                    <p className="text-sm font-bold" style={{ color: trust.color }}>
                      {mint.trustScore.totalScore}/100
                    </p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Tx Success</p>
                    <p className="text-sm font-bold text-white">
                      {mint.txTotal > 0
                        ? `${Math.round((mint.txSuccess / mint.txTotal) * 100)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Score Breakdown</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <ScoreItem label="Info Responsive" value={mint.trustScore.infoResponsive} points={20} />
                    <ScoreItem label="Operator Info" value={mint.trustScore.hasOperatorInfo} points={10} />
                    <ScoreItem label="Current Version" value={mint.trustScore.currentVersion} points={10} />
                    <ScoreItem label="Keyset Stable" value={mint.trustScore.keysetStable} points={20} />
                    <ScoreItem label="Tx Success Rate" value={mint.trustScore.txSuccessRate > 15} points={mint.trustScore.txSuccessRate} maxPoints={20} />
                    <ScoreItem label="Session Uptime" value={mint.trustScore.uptimeClean} points={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScoreItem({
  label,
  value,
  points,
  maxPoints,
}: {
  label: string;
  value: boolean;
  points: number;
  maxPoints?: number;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-900/30 rounded px-2 py-1.5">
      <span className="text-gray-400">{label}</span>
      <span className={value ? 'text-green-400' : 'text-gray-600'}>
        {value ? `+${points}` : '0'}/{maxPoints ?? points}
      </span>
    </div>
  );
}
