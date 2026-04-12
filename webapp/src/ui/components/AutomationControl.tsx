import { useState, useEffect } from 'react';
import { useStore } from '../../state/store';
import { walletApi } from '../../core/walletApi';
import type { AutomationMode } from '../../state/types';
import { Monitor, Webhook, Bot } from 'lucide-react';

const modes: {
  mode: AutomationMode;
  label: string;
  layerName: string;
  description: string;
  whoItsFor: string;
  icon: typeof Bot;
  color: string;
}[] = [
  {
    mode: 'manual',
    label: 'Dashboard Only',
    layerName: 'Layer 1',
    description: 'Passive monitoring. Runs health checks, computes trust scores, displays them. No automated action.',
    whoItsFor: 'Companies with compliance requirements around manual approval of fund movements.',
    icon: Monitor,
    color: '#58a6ff',
  },
  {
    mode: 'alert',
    label: 'Webhook / Alert',
    layerName: 'Layer 2',
    description: 'When a score crosses a threshold, fires a webhook to Slack, PagerDuty, or custom endpoint. Team decides action.',
    whoItsFor: 'Treasury teams that want L3 integrated into existing ops workflow.',
    icon: Webhook,
    color: '#d29922',
  },
  {
    mode: 'auto',
    label: 'Full Automation',
    layerName: 'Layer 3',
    description: 'When score drops below threshold, L3 autonomously migrates funds to the healthiest mint. Logs everything for audit.',
    whoItsFor: 'Companies that want hands-off custody management with policy-based automation.',
    icon: Bot,
    color: '#3fb950',
  },
];

export default function AutomationControl() {
  const { state, dispatch } = useStore();
  const [discordStatus, setDiscordStatus] = useState<{ configured: boolean; channelId: string | null } | null>(null);
  const [testResult, setTestResult] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle');

  useEffect(() => {
    if (state.automationMode === 'alert' || state.automationMode === 'auto') {
      walletApi.getDiscordStatus().then(setDiscordStatus);
    }
  }, [state.automationMode]);

  const handleTestDiscord = async () => {
    setTestResult('sending');
    const result = await walletApi.testDiscord();
    setTestResult(result.ok ? 'success' : 'failed');
    setTimeout(() => setTestResult('idle'), 3000);
  };

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h3 className="text-sm font-mono font-semibold text-[#c9d1d9] mb-1">
        Layers of Trust — Choose Your Level
      </h3>
      <p className="text-[10px] font-mono text-[#8b949e] mb-4">
        Your treasury policy determines the operational mode. L3 adapts to your risk tolerance.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {modes.map(({ mode, label, layerName, description, whoItsFor, icon: Icon, color }) => {
          const isActive = state.automationMode === mode;
          return (
            <button
              key={mode}
              onClick={() => dispatch({ type: 'SET_AUTOMATION_MODE', mode })}
              className={`text-left rounded-lg border p-3 transition-all duration-200 ${
                isActive
                  ? 'shadow-lg'
                  : 'border-[#30363d] bg-[#0d1117] hover:border-[#58a6ff]/30'
              }`}
              style={isActive ? {
                borderColor: `${color}66`,
                backgroundColor: `${color}10`,
                boxShadow: `0 0 15px ${color}15`,
              } : undefined}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color,
                    backgroundColor: `${color}20`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  {layerName}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: isActive ? color : '#8b949e' }} />
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: isActive ? color : '#c9d1d9' }}
                >
                  {label}
                </span>
              </div>
              <p className="text-[9px] font-mono text-[#8b949e] leading-relaxed mb-2">
                {description}
              </p>
              <p className="text-[8px] font-mono text-[#8b949e]/60 leading-relaxed italic">
                {whoItsFor}
              </p>
              {isActive && (
                <div className="mt-2 text-[9px] font-mono font-semibold" style={{ color }}>
                  ACTIVE
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Webhook example payload for Layer 2 */}
      {state.automationMode === 'alert' && (
        <div className="mt-3 rounded-lg border border-[#d29922]/20 bg-[#0d1117] p-3">
          <div className="text-[9px] font-mono text-[#d29922] font-semibold mb-2">
            Example Webhook Payload
          </div>
          <pre className="text-[9px] font-mono text-[#8b949e] leading-relaxed overflow-x-auto">
{`{
  "event": "mint_score_drop",
  "mint_url": "https://mint-b.example.com",
  "previous_score": 72,
  "current_score": 43,
  "threshold": 50,
  "red_flags": ["keyset_changed", "consecutive_failures_3"],
  "recommended_action": "migrate_to_best_mint",
  "timestamp": "${new Date().toISOString()}"
}`}
          </pre>
        </div>
      )}

      {/* Discord notification status */}
      {(state.automationMode === 'alert' || state.automationMode === 'auto') && discordStatus && (
        <div className="mt-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${discordStatus.configured ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`} />
              <span className="text-[10px] font-mono text-[#c9d1d9]">
                Discord {discordStatus.configured ? 'Connected' : 'Not Configured'}
              </span>
            </div>
            {discordStatus.configured && (
              <button
                onClick={handleTestDiscord}
                disabled={testResult === 'sending'}
                className="text-[9px] font-mono px-2 py-1 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d] hover:bg-[#30363d] hover:text-[#c9d1d9] transition-colors disabled:opacity-40"
              >
                {testResult === 'sending' ? 'Sending...' : testResult === 'success' ? 'Sent!' : testResult === 'failed' ? 'Failed' : 'Test Discord'}
              </button>
            )}
          </div>
          {!discordStatus.configured && (
            <p className="text-[8px] font-mono text-[#8b949e] mt-1.5">
              Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID env vars to enable notifications.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
