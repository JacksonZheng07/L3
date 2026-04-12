/**
 * Discord Bot Notifier — sends TrustAlert embeds to a Discord channel.
 * Uses the Discord REST API directly (no discord.js dependency).
 * Requires Node >= 22 for native fetch.
 */

import { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID } from './config.js';
import type { TrustAlert } from '../src/state/types.js';

const DISCORD_API = 'https://discord.com/api/v10';

const COLOR_MAP: Record<TrustAlert['type'], number> = {
  critical:            0xf85149,
  score_drop:          0xd29922,
  migration_suggested: 0x58a6ff,
  migration_executed:  0x3fb950,
  recovery:            0x3fb950,
};

const TITLE_MAP: Record<TrustAlert['type'], string> = {
  critical:            'CRITICAL — Immediate Action Required',
  score_drop:          'Score Drop Detected',
  migration_suggested: 'Migration Suggested',
  migration_executed:  'Migration Executed',
  recovery:            'Mint Recovered',
};

function alertToEmbed(alert: TrustAlert) {
  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: 'Mint', value: alert.mintName, inline: true },
    { name: 'Score', value: `${alert.score.toFixed(0)}/100`, inline: true },
  ];
  if (alert.previousScore !== undefined) {
    fields.push({ name: 'Previous', value: `${alert.previousScore.toFixed(0)}/100`, inline: true });
  }
  if (alert.actionTaken) {
    fields.push({ name: 'Action', value: alert.actionTaken, inline: true });
  }
  return {
    title: TITLE_MAP[alert.type] ?? alert.type,
    description: alert.message,
    color: COLOR_MAP[alert.type] ?? 0x8b949e,
    fields,
    timestamp: alert.timestamp,
    footer: { text: 'L3 Trust Engine' },
  };
}

/**
 * Send alerts to the configured Discord channel as rich embeds.
 * Returns true on success, false on failure. Never throws.
 */
export async function sendDiscordAlerts(alerts: TrustAlert[]): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) return false;
  if (alerts.length === 0) return true;

  // Discord allows max 10 embeds per message
  const embeds = alerts.slice(0, 10).map(alertToEmbed);

  try {
    const res = await fetch(
      `${DISCORD_API}/channels/${DISCORD_CHANNEL_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[Discord] Failed to send (${res.status}):`, body);
      return false;
    }
    console.log(`[Discord] Sent ${alerts.length} alert(s) to channel ${DISCORD_CHANNEL_ID}`);
    return true;
  } catch (err) {
    console.error('[Discord] Network error:', err);
    return false;
  }
}
