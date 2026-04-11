interface Props {
  onClose: () => void;
}

const tiers = [
  {
    label: 'Cashu',
    tag: 'You are here',
    color: 'text-amber-400',
    border: 'border-amber-500/15',
    bg: 'bg-amber-500/[0.06]',
    dot: 'bg-amber-400',
    description:
      'Convenient custodial ecash. Trust is scored and funds migrate automatically. Great for small amounts and daily spending.',
  },
  {
    label: 'Ark',
    tag: 'Next step',
    color: 'text-blue-400',
    border: 'border-blue-500/15',
    bg: 'bg-blue-500/[0.06]',
    dot: 'bg-blue-400',
    description:
      'Self-custodial Layer 2. Your keys, your coins. Lightning-fast transactions with on-chain settlement guarantees.',
  },
  {
    label: 'On-Chain',
    tag: 'Full sovereignty',
    color: 'text-emerald-400',
    border: 'border-emerald-500/15',
    bg: 'bg-emerald-500/[0.06]',
    dot: 'bg-emerald-400',
    description:
      'Direct Bitcoin blockchain transactions. Maximum security and decentralization. Best for long-term savings.',
  },
];

export function GraduationModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass-elevated rounded-3xl max-w-md w-full p-7 space-y-6 animate-fade-up">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="font-display text-lg font-bold text-white">Ready for Self-Custody?</h2>
          <p className="text-[13px] text-white/30 leading-relaxed">
            Your balance is growing. Here's your path to sovereignty.
          </p>
        </div>

        {/* Tiers */}
        <div className="space-y-2.5">
          {tiers.map((tier, i) => (
            <div key={tier.label} className={`${tier.bg} border ${tier.border} rounded-2xl p-4 transition-all`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${tier.dot}`} />
                  <h3 className={`font-display text-sm font-semibold ${tier.color}`}>{tier.label}</h3>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tier.bg} border ${tier.border} ${tier.color}`}>
                  {tier.tag}
                </span>
              </div>
              <p className="text-[12px] text-white/30 leading-relaxed">{tier.description}</p>
              {i < tiers.length - 1 && (
                <div className="flex justify-center mt-3 -mb-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white/10">
                    <path d="M12 5v14m0 0l-7-7m7 7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            disabled
            className="btn-primary w-full glass text-white/20 py-3.5 rounded-2xl cursor-not-allowed border border-white/[0.04]"
          >
            Upgrade to Self-Custody — Coming Soon
          </button>
          <button
            onClick={onClose}
            className="w-full text-white/25 hover:text-white/50 py-2.5 text-[13px] transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
