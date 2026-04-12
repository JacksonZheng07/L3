import { useState } from 'react';
import type { Federation, EntityWallet } from '../../state/types';
import { Shield, Users, Cpu, Link, Wallet, ChevronDown, ChevronUp, Lock } from 'lucide-react';

// ── Mock Fedimint Data ────────────────────────────────────────

const MOCK_FEDERATIONS: Federation[] = [
  {
    id: 'fed-alpha',
    name: 'Alpine Federation',
    guardians: [
      { id: 'g1', name: 'Guardian A (Zurich)', role: 'guardian', balanceSats: 250000, address: 'bc1q...zurich', federationId: 'fed-alpha' },
      { id: 'g2', name: 'Guardian B (Singapore)', role: 'guardian', balanceSats: 250000, address: 'bc1q...singapore', federationId: 'fed-alpha' },
      { id: 'g3', name: 'Guardian C (New York)', role: 'guardian', balanceSats: 250000, address: 'bc1q...newyork', federationId: 'fed-alpha' },
      { id: 'g4', name: 'Guardian D (London)', role: 'guardian', balanceSats: 250000, address: 'bc1q...london', federationId: 'fed-alpha' },
      { id: 'g5', name: 'Guardian E (Tokyo)', role: 'guardian', balanceSats: 250000, address: 'bc1q...tokyo', federationId: 'fed-alpha' },
    ],
    threshold: 3,
    totalGuardians: 5,
    mintUrl: 'https://fed-alpha.example.com',
    trustScore: 92,
    status: 'healthy',
  },
  {
    id: 'fed-beta',
    name: 'Citadel Federation',
    guardians: [
      { id: 'g6', name: 'Guardian X (Berlin)', role: 'guardian', balanceSats: 180000, address: 'bc1q...berlin', federationId: 'fed-beta' },
      { id: 'g7', name: 'Guardian Y (Lisbon)', role: 'guardian', balanceSats: 180000, address: 'bc1q...lisbon', federationId: 'fed-beta' },
      { id: 'g8', name: 'Guardian Z (Dubai)', role: 'guardian', balanceSats: 180000, address: 'bc1q...dubai', federationId: 'fed-beta' },
    ],
    threshold: 2,
    totalGuardians: 3,
    mintUrl: 'https://fed-beta.example.com',
    trustScore: 78,
    status: 'healthy',
  },
];

const MOCK_ENTITY_WALLETS: EntityWallet[] = [
  { id: 'user-1', name: 'L3 User Wallet', role: 'user', balanceSats: 50000, address: 'lnbc1...user' },
  { id: 'mint-a', name: 'Mint A (Stable)', role: 'mint_operator', balanceSats: 500000, address: 'bc1q...mintA', mintUrl: 'https://mint.minibits.cash/Bitcoin' },
  { id: 'mint-b', name: 'Mint B (Risky)', role: 'mint_operator', balanceSats: 120000, address: 'bc1q...mintB', mintUrl: 'https://testnut.cashu.space' },
  { id: 'fed-wallet', name: 'Alpine Federation', role: 'federation', balanceSats: 1250000, address: 'bc1q...fedAlpha', federationId: 'fed-alpha' },
];

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

// ── Component ──────────────────────────────────────────────────

export default function FedimintArchitecture() {
  const [expandedFed, setExpandedFed] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Entity Wallets */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={16} className="text-[#58a6ff]" />
          <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
            Entity Wallets
          </h3>
        </div>
        <p className="text-[10px] font-mono text-[#8b949e] mb-4">
          Every participant in the L3 ecosystem has a dedicated wallet. In production, these are
          created via Voltage (LND) for Lightning or on-chain addresses.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MOCK_ENTITY_WALLETS.map((wallet) => {
            const color = roleColor[wallet.role];
            const Icon = roleIcon[wallet.role];
            return (
              <div
                key={wallet.id}
                className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color }} />
                  <span className="text-xs font-mono font-semibold text-[#c9d1d9]">
                    {wallet.name}
                  </span>
                  <span
                    className="text-[8px] font-mono px-1.5 py-0.5 rounded"
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
                  <div className="flex justify-between text-[#8b949e]">
                    <span>Address</span>
                    <span className="text-[#58a6ff]/70 truncate max-w-[140px]">
                      {wallet.address}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fedimint Federations */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-[#3fb950]" />
          <h3 className="text-sm font-mono font-semibold text-[#c9d1d9]">
            Fedimint Federations
          </h3>
        </div>
        <p className="text-[10px] font-mono text-[#8b949e] mb-2">
          Fedimint federations use Byzantine fault tolerance (m-of-n threshold signing) to eliminate
          single-operator risk. No single guardian can rug the federation.
        </p>
        <div className="text-[10px] font-mono text-[#3fb950]/80 bg-[#3fb950]/5 rounded px-3 py-2 mb-4 border border-[#3fb950]/20">
          L3 scores Fedimint federations structurally higher (+15 base trust points) because
          multi-guardian consensus eliminates single-point-of-failure.
        </div>

        <div className="space-y-3">
          {MOCK_FEDERATIONS.map((fed) => {
            const isExpanded = expandedFed === fed.id;
            const statusColor = fed.status === 'healthy' ? '#3fb950' : fed.status === 'degraded' ? '#d29922' : '#f85149';
            return (
              <div
                key={fed.id}
                className="rounded-lg border border-[#30363d] bg-[#0d1117] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFed(isExpanded ? null : fed.id)}
                  className="w-full text-left p-4 hover:bg-[#161b22]/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Lock size={12} className="text-[#3fb950]" />
                        <span className="text-sm font-mono font-semibold text-[#c9d1d9]">
                          {fed.name}
                        </span>
                      </div>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          color: statusColor,
                          backgroundColor: `${statusColor}20`,
                          border: `1px solid ${statusColor}30`,
                        }}
                      >
                        {fed.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-mono font-bold text-[#3fb950]">
                          {fed.trustScore}
                        </div>
                        <div className="text-[9px] font-mono text-[#8b949e]">trust score</div>
                      </div>
                      {isExpanded ? <ChevronUp size={14} className="text-[#8b949e]" /> : <ChevronDown size={14} className="text-[#8b949e]" />}
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="flex gap-4 mt-2 text-[10px] font-mono text-[#8b949e]">
                    <span>
                      <span className="text-[#c9d1d9]">{fed.threshold}-of-{fed.totalGuardians}</span> threshold
                    </span>
                    <span>
                      <span className="text-[#c9d1d9]">{fed.totalGuardians}</span> guardians
                    </span>
                    <span>
                      <span className="text-[#c9d1d9]">{fed.guardians.reduce((s, g) => s + g.balanceSats, 0).toLocaleString()}</span> sats pooled
                    </span>
                  </div>
                </button>

                {/* Expanded: Guardian Details */}
                {isExpanded && (
                  <div className="border-t border-[#30363d] p-4 space-y-3">
                    <div className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider mb-2">
                      Guardian Nodes
                    </div>
                    {/* Threshold visualization */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-[10px] font-mono text-[#8b949e]">Consensus:</div>
                      <div className="flex gap-1">
                        {Array.from({ length: fed.totalGuardians }).map((_, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-mono font-bold border"
                            style={{
                              backgroundColor: i < fed.threshold ? '#3fb95020' : '#21262d',
                              borderColor: i < fed.threshold ? '#3fb95050' : '#30363d',
                              color: i < fed.threshold ? '#3fb950' : '#8b949e',
                            }}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] font-mono text-[#3fb950]">
                        {fed.threshold} required to sign
                      </div>
                    </div>

                    {/* Guardian list */}
                    <div className="space-y-2">
                      {fed.guardians.map((guardian) => (
                        <div
                          key={guardian.id}
                          className="flex items-center justify-between rounded bg-[#161b22] border border-[#21262d] p-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
                            <span className="text-[10px] font-mono text-[#c9d1d9]">
                              {guardian.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[#8b949e]">
                            {guardian.balanceSats.toLocaleString()} sats
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Trust score breakdown for federation */}
                    <div className="mt-3 pt-3 border-t border-[#21262d]">
                      <div className="text-[10px] font-mono text-[#8b949e] uppercase tracking-wider mb-2">
                        Fedimint Trust Bonus
                      </div>
                      <div className="space-y-1 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-[#8b949e]">Base score (protocol checks)</span>
                          <span className="text-[#c9d1d9]">{fed.trustScore - 15}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#3fb950]">+ Federation architecture bonus</span>
                          <span className="text-[#3fb950]">+15</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8b949e]">Guardian diversity ({fed.totalGuardians} jurisdictions)</span>
                          <span className="text-[#c9d1d9]">1.0</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8b949e]">Consensus strength ({fed.threshold}-of-{fed.totalGuardians})</span>
                          <span className="text-[#c9d1d9]">{(fed.threshold / fed.totalGuardians).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-[#21262d]">
                          <span className="text-[#c9d1d9] font-semibold">Composite trust score</span>
                          <span className="text-[#3fb950] font-bold">{fed.trustScore}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Architecture Diagram */}
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
              <div>Max trust score: ~80 (capped by architecture)</div>
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
              <div>Max trust score: 100 (+15 architecture bonus)</div>
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
