import { useState } from 'react';
import { useStore } from '../../state/store';
import WalletConnectPanel from '../components/WalletConnectPanel';
import TransferPanel from '../components/TransferPanel';
import ReceivePanel from '../components/ReceivePanel';
import MigrationLog from '../components/MigrationLog';
import { Wallet, ArrowRightLeft, Download, History, RefreshCw } from 'lucide-react';
import { gradeColor } from '../../lib/theme';

type ActiveTab = 'receive' | 'transfer';

export default function WalletScreen() {
  const { state, effectiveScores, refreshBalances } = useStore();
  const { balances, migrations } = state;

  const [activeTab, setActiveTab] = useState<ActiveTab>('receive');

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-6">
      {/* ── Entity wallet balance strip ── */}
      <div className="rounded-xl border border-[#21262d] bg-[#161b22] px-5 py-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-[#58a6ff]" />
            <span className="text-xs font-mono font-semibold text-[#c9d1d9]">Entity Wallets</span>
            {balances.length > 0 && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20">
                {balances.length} MINT{balances.length !== 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalBalance > 0 && (
              <span className="text-sm font-mono font-bold text-[#c9d1d9] tabular-nums">
                {totalBalance.toLocaleString()}{' '}
                <span className="text-[#8b949e] font-normal text-xs">sats total</span>
              </span>
            )}
            <button
              onClick={refreshBalances}
              className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
              title="Refresh balances"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {balances.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {balances.map((b) => {
              const score = effectiveScores.find((s) => s.url === b.mintUrl);
              const color = score ? gradeColor(score.grade) : '#8b949e';
              const pct   = totalBalance > 0 ? (b.balance / totalBalance) * 100 : 0;
              return (
                <div
                  key={b.mintUrl}
                  className="rounded-lg border bg-[#0d1117] px-3 py-2.5"
                  style={{ borderColor: `${color}25` }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[10px] font-mono text-[#c9d1d9] truncate flex-1">{b.mintName}</span>
                  </div>
                  <div className="text-sm font-mono font-bold tabular-nums" style={{ color }}>
                    {b.balance.toLocaleString()}
                  </div>
                  <div className="text-[9px] font-mono text-[#8b949e] mt-0.5">{pct.toFixed(1)}% of total</div>
                  <div className="mt-2 h-1 bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs font-mono text-[#8b949e]/60 py-2">
            Connect your wallet below to see balances here.
          </p>
        )}
      </div>

      {/* ── Left: connect; Right: tabbed receive/transfer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Wallet connect */}
        <WalletConnectPanel />

        {/* Tabbed operations panel */}
        <div
          className="rounded-xl border border-[#21262d] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)' }}
        >
          {/* Tab bar */}
          <div className="flex bg-[#161b22] border-b border-[#21262d]">
            {([
              { id: 'receive',  label: 'Receive',  icon: Download },
              { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
            ] as { id: ActiveTab; label: string; icon: typeof Download }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-2 px-5 py-3 text-xs font-mono transition-all border-b-2 -mb-px"
                style={
                  activeTab === id
                    ? { borderColor: '#58a6ff', color: '#58a6ff', background: 'rgba(88,166,255,0.05)' }
                    : { borderColor: 'transparent', color: '#8b949e' }
                }
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
          {/* Panel body — top border already provided by tab bar */}
          <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
            {activeTab === 'receive'  && <ReceivePanel />}
            {activeTab === 'transfer' && <TransferPanel />}
          </div>
        </div>
      </div>

      {/* ── Transfer history ── */}
      {migrations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History size={13} className="text-[#8b949e]" />
            <span className="text-xs font-mono font-semibold text-[#8b949e]">Transfer History</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d]">
              {migrations.length}
            </span>
            <div className="flex gap-3 ml-auto text-[9px] font-mono">
              {[
                { label: 'completed', color: '#3fb950' },
                { label: 'failed',    color: '#f85149' },
                { label: 'pending',   color: '#d29922' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[#8b949e]">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <MigrationLog />
        </div>
      )}
    </div>
  );
}
