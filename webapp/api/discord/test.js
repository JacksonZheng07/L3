/**
 * Vercel Serverless Function: Discord Test Alert
 */

const DISCORD_API = 'https://discord.com/api/v10';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    return res.json({ ok: false, error: 'Discord not configured' });
  }

  try {
    const response = await fetch(
      `${DISCORD_API}/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            title: 'L3 Test Alert',
            description: 'If you see this, Discord integration is working correctly.',
            color: 0x3fb950,
            timestamp: new Date().toISOString(),
            footer: { text: 'L3 Trust Engine — Test' },
          }],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      return res.json({ ok: false, error: `Discord API error: ${response.status} — ${body}` });
    }

    return res.json({ ok: true, data: undefined });
  } catch (err) {
    return res.json({ ok: false, error: `Network error: ${err.message}` });
  }
}
