/**
 * Vercel Serverless Function: Discord Alert Notifier
 *
 * Sends TrustAlert embeds to a Discord channel via Discord REST API v10.
 * Requires DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID environment variables.
 */

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '';

const COLOR_MAP = {
  critical:            0xf85149,
  score_drop:          0xd29922,
  migration_suggested: 0x58a6ff,
  migration_executed:  0x3fb950,
  recovery:            0x3fb950,
};

const TITLE_MAP = {
  critical:            'CRITICAL — Immediate Action Required',
  score_drop:          'Score Drop Detected',
  migration_suggested: 'Migration Suggested',
  migration_executed:  'Migration Executed',
  recovery:            'Mint Recovered',
};

function alertToEmbed(alert) {
  const fields = [
    { name: 'Mint', value: alert.mintName, inline: true },
    { name: 'Score', value: `${Math.round(alert.score)}/100`, inline: true },
  ];
  if (alert.previousScore !== undefined) {
    fields.push({ name: 'Previous', value: `${Math.round(alert.previousScore)}/100`, inline: true });
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    return res.json({ ok: false, error: 'Discord not configured (missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID)' });
  }

  const { alerts } = req.body || {};
  if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
    return res.status(400).json({ ok: false, error: 'alerts array is required' });
  }

  // Discord allows max 10 embeds per message
  const embeds = alerts.slice(0, 10).map(alertToEmbed);

  try {
    const response = await fetch(
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

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Discord] Failed to send (${response.status}):`, body);
      return res.json({ ok: false, error: `Discord API error: ${response.status}` });
    }

    console.log(`[Discord] Sent ${alerts.length} alert(s) to channel ${DISCORD_CHANNEL_ID}`);
    return res.json({ ok: true, data: { sent: alerts.length } });
  } catch (err) {
    console.error('[Discord] Network error:', err);
    return res.json({ ok: false, error: `Network error: ${err.message}` });
  }
}
