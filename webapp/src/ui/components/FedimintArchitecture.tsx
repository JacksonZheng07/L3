import { useState } from 'react';
import { useStore } from '../../state/store';
import { Shield, Users, Cpu, Link, Wallet, ChevronDown, ChevronUp, Lock } from 'lucide-react';

const roleColor: Record<string, string> = {
  user: '#58a6ff',
  mint_operator: '#d29922',
  guardian: '#a855f7',
  federation: '#3fb950',
};

const roleIcon: Record<string, typeof Wallet> = {
  user: Wallet,
  mint_operator: Cpu,
  guardian: Shield,
  federation: Users,
};

export default function FedimintArchitecture() {
  const { state, effectiveScores } = useStore();
  const [expandedFed, setExpandedFed] = useState<string | null>(null);

  // Derive entity wallets from real state
  const entityWallets = [
    // User wallet — real balance from walletEngine
    {
      id: 'user-wallet',
      name: 'L3 User Wallet',
      role: 'user' as const,
      balanceSats: state.totalBalance,
      address: 'Browser (ecash proofs in localStorage)',
    },
    // Derive mint operator wallets from real scores + balances
    ...effectiveScores.map((score) => {
      const walletBalance = state.balances.find((b) => b.mintUrl === score.url);
      return {
        id: `mint-${score.url}`,
        name: score.name,
        role: 'mint_operator' as const,
        balanceSats: walletBalance?.balance ?? 0,
        address: score.url,
        extra: {
          online: score.isOnline,
          trustScore: score.compositeScore,
          grade: score.grade,
          latencyMs: score.latencyMs,
        },
      };
    }),
  ];

  // Derive federation-like groupings from scored mints
  // Group safe mints as a "virtual federation" to show the concept
  const safeMints = effectiveScores.filter((s) => s.grade === 'safe');
  const warningMints = effectiveScores.filter((s) => s.grade === 'warning');
  const criticalMints = effectiveScores.filter((s) => s.grade === 'critical');

  const federationGroups = [
    ...(safeMints.length > 0
      ? [
          {
            id: 'safe-cluster',
            name: 'Safe Mint Cluster',
            description: 'Mints scoring >= 75. In a Fedimint model, these would form a high-trust federation.',
            mints: safeMints,
            avgScore: safeMints.reduce((s, m) => s + m.compositeScore, 0) / safeMints.length,
            status: 'healthy' as const,
            potentialThreshold: Math.ceil(safeMints.length * 0.6), // 60% threshold
          },
        ]
      : []),
    ...(warningMints.length > 0
      ? [
          {
            id: 'warning-cluster',
            name: 'Warning Mint Cluster',
            description: 'Mints scoring 50-74. Require monitoring. Federation threshold would need to be higher.',
            mints: warningMints,
            avgScore: warningMints.reduce((s, m) => s + m.compositeScore, 0) / warningMints.length,
            status: 'degraded' as const,
            potentialThreshold: Math.ceil(warningMints.length * 0.75), // 75% threshold
          },
        ]
      : []),
    ...(criticalMints.length > 0
      ? [
          {
            id: 'critical-cluster',
            name: 'Critical Mints (Excluded)',
            description: 'Mints scoring < 50. Zero allocation. Would be excluded from any federation.',
            mints: criticalMints,
            avgScore: criticalMints.reduce((s, m) => s + m.compositeScore, 0) / criticalMints.length,
            status: 'offline' as const,
            potentialThreshold: 0,
          },
        ]
      : []),
  ];

  const statusColor = (status: string) =>
    status === 'healthy' ? '#3fb950' : status === 'degraded' ? '#d29922' : '#f85149';

  return (
    <div className="space-y-6">
      {/* Entity Wallets — derived from real state */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={16} className="text-[#58a6ff]" />
          <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
            Entity Wallets (Live)
          </h3>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#3fb950]/20 text-[#3fb950] border border-[#3fb950]/30">
            REAL DATA
          </span>
        </div>
        <p className="text-[10px] font-mono text-[#8b949e] mb-4">
          Wallets derived from live wallet engine state and mint probe results.
          In production, each entity has a dedicated Voltage LND node or Cashu wallet.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entityWallets.slice(0, 7).map((wallet) => {
            const color = roleColor[wallet.role];
            const Icon = roleIcon[wallet.role];
            const extra = 'extra' in wallet ? (wallet as { extra: { online: boolean; trustScore: number; grade: string; latencyMs: number } }).extra : null;
            return (
              <div
                key={wallet.id}
                className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color }} />
                  <span className="text-xs font-mono font-semibold text-[#c9d1d9] truncate max-w-[160px]">
                    {wallet.name}
                  </span>
                  <span
                    className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
                  >
                    {wallet.role.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between text-[#8b949e]">
                    <span>Balance</span>
                    <span className="text-[#c9d1d9] font-semibold">
                      {wallet.balanceSats.toLocaleString()} sats
                    </span>
                  </div>
                  {extra && (
                    <>
                      <div className="flex justify-between text-[#8b949e]">
                        <span>Status</span>
                        <span style={{ color: extra.online ? '#3fb950' : '#f85149' }}>
                          {extra.online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#8b949e]">
                        <span>Trust Score</span>
                        <span style={{ color: extra.grade === 'safe' ? '#3fb950' : extra.grade === 'warning' ? '#d29922' : '#f85149' }}>
                          {extra.trustScore.toFixed(0)}/100
                        </span>
                      </div>
                      <div className="flex justify-between text-[#8b949e]">
                        <span>Latency</span>
                        <span className="text-[#c9d1d9]">{extra.latencyMs}ms</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-[#8b949e]">
                    <span>Endpoint</span>
                    <span className="text-[#58a6ff]/70 truncate max-w-[140px]">
                      {wallet.address}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {entityWallets.length > 7 && (
          <div className="text-[10px] font-mono text-[#8b949e] mt-2 text-center">
            + {entityWallets.length - 7} more mint wallets
          </div>
        )}
      </div>

      {/* Federation Clusters — derived from real scores */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-[#3fb950]" />
          <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
            Fedimint Federation Model
          </h3>
        </div>
        <p className="text-[10px] font-mono text-[#8b949e] mb-2">
          Fedimint federations use Byzantine fault tolerance (m-of-n threshold signing) to eliminate
          single-operator risk. Below shows how current mints would map to federation tiers.
        </p>
        <div className="text-[10px] font-mono text-[#3fb950]/80 bg-[#3fb950]/5 rounded px-3 py-2 mb-4 border border-[#3fb950]/20">
          Fedimint federations score +15 base trust points because multi-guardian consensus
          eliminates single-point-of-failure. Current scores below are from live probes.
        </div>

        {effectiveScores.length === 0 ? (
          <div className="text-xs font-mono text-[#8b949e] text-center py-6">
            Waiting for live scoring data...
          </div>
        ) : (
          <div className="space-y-3">
            {federationGroups.map((group) => {
              const isExpanded = expandedFed === group.id;
              const color = statusColor(group.status);
              return (
                <div
                  key={group.id}
                  className="rounded-lg border border-[#30363d] bg-[#0d1117] overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFed(isExpanded ? null : group.id)}
                    className="w-full text-left p-4 hover:bg-[#161b22]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Lock size={12} style={{ color }} />
                        <span className="text-sm font-mono font-semibold text-[#c9d1d9]">
                          {group.name}
                        </span>
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
                        >
                          {group.mints.length} MINTS
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-mono font-bold" style={{ color }}>
                            {group.avgScore.toFixed(0)}
                          </div>
                          <div className="text-[9px] font-mono text-[#8b949e]">avg score</div>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-[#8b949e]" /> : <ChevronDown size={14} className="text-[#8b949e]" />}
                      </div>
                    </div>
                    <p className="text-[10px] font-mono text-[#8b949e] mt-1">
                      {group.description}
                    </p>
                    {group.potentialThreshold > 0 && (
                      <div className="text-[10px] font-mono text-[#8b949e] mt-1">
                        Potential federation: <span className="text-[#c9d1d9]">{group.potentialThreshold}-of-{group.mints.length}</span> threshold
                      </div>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#30363d] p-4 space-y-3">
                      {group.potentialThreshold > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-[10px] font-mono text-[#8b949e]">Consensus:</div>
                          <div className="flex gap-1 flex-wrap">
                            {group.mints.map((m, i) => (
                              <div
                                key={m.url}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-mono font-bold border"
                                style={{
                                  backgroundColor: i < group.potentialThreshold ? `${color}20` : '#21262d',
                                  borderColor: i < group.potentialThreshold ? `${color}50` : '#30363d',
                                  color: i < group.potentialThreshold ? color : '#8b949e',
                                }}
                                title={m.name}
                              >
                                {i + 1}
                              </div>
                            ))}
                          </div>
                          <div className="text-[10px] font-mono" style={{ color }}>
                            {group.potentialThreshold} required
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {group.mints.map((mint) => (
                          <div
                            key={mint.url}
                            className="flex items-center justify-between rounded bg-[#161b22] border border-[#21262d] p-2"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: mint.isOnline ? '#3fb950' : '#f85149',
                                  animation: mint.isOnline ? 'pulse 2s infinite' : 'none',
                                }}
                              />
                              <span className="text-[10px] font-mono text-[#c9d1d9] truncate max-w-[200px]">
                                {mint.name}
                              </span>
                              <span className="text-[9px] font-mono text-[#8b949e]">
                                {mint.latencyMs}ms
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono" style={{ color: statusColor(mint.grade === 'safe' ? 'healthy' : mint.grade === 'warning' ? 'degraded' : 'offline') }}>
                                {mint.compositeScore.toFixed(0)}
                              </span>
                              <span className="text-[10px] font-mono text-[#8b949e]">
                                {mint.allocationPct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Fedimint trust bonus explanation */}
                      {group.status === 'healthy' && (
                        <div className="mt-3 pt-3 border-t border-[#21262d]">
                          <div className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider mb-2">
                            If This Were a Fedimint Federation
                          </div>
                          <div className="space-y-1 text-[10px] font-mono">
                            <div className="flex justify-between">
                              <span className="text-[#8b949e]">Average base score</span>
                              <span className="text-[#c9d1d9]">{group.avgScore.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#3fb950]">+ Federation architecture bonus</span>
                              <span className="text-[#3fb950]">+15</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#8b949e]">Guardian diversity ({group.mints.length} operators)</span>
                              <span className="text-[#c9d1d9]">1.0</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-[#21262d]">
                              <span className="text-[#c9d1d9] font-semibold">Projected federation score</span>
                              <span className="text-[#3fb950] font-bold">
                                {Math.min(100, group.avgScore + 15).toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Architecture Comparison */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Link size={16} className="text-[#a855f7]" />
          <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
            How Fedimint Assists L3
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-[#0d1117] border border-[#21262d] p-4">
            <div className="text-[11px] font-mono font-semibold text-[#d29922] mb-2">
              Cashu Mint (Single Operator)
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed space-y-1">
              <div>1 operator controls all keys</div>
              <div>Single point of failure</div>
              <div>Current live scores: {effectiveScores.length} mints tracked</div>
              <div>Migration: melt via Lightning, mint on target</div>
            </div>
          </div>

          <div className="rounded-lg bg-[#0d1117] border border-[#3fb950]/20 p-4">
            <div className="text-[11px] font-mono font-semibold text-[#3fb950] mb-2">
              Fedimint Federation (Multi-Guardian)
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] leading-relaxed space-y-1">
              <div>m-of-n threshold signing (BFT consensus)</div>
              <div>No single guardian can rug</div>
              <div>+15 trust bonus over equivalent single-operator score</div>
              <div>Migration: same Lightning rails, higher base trust</div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-[10px] font-mono text-[#8b949e] leading-relaxed bg-[#0d1117] rounded-lg border border-[#21262d] p-3">
          <span className="text-[#a855f7] font-semibold">SDK:</span>{' '}
          <code className="text-[#58a6ff]">@fedimint/core-web</code> +{' '}
          <code className="text-[#58a6ff]">@fedimint/react</code> — WASM-powered browser client.
          Supports joining federations, ecash mint/spend/reissue, Lightning gateway, and multi-federation management.
        </div>
      </div>
    </div>
  );
}
