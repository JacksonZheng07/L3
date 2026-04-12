/**
 * Vercel Serverless Function: Allium API Proxy
 *
 * Proxies requests to the Allium API, keeping the API key server-side.
 * Frontend calls: POST /api/allium?endpoint=/wallet/balances
 * This function forwards to: POST https://api.allium.so/api/v1/developer/wallet/balances
 */

const ALLIUM_API_KEY = process.env.ALLIUM_API_KEY || process.env.VITE_ALLIUM_API_KEY || '';
const ALLIUM_BASE_URL = 'https://api.allium.so/api/v1/developer';

const ALLOWED_ENDPOINTS = [
  '/wallet/balances',
  '/wallet/balances/history',
  '/wallet/transactions',
  '/wallet/positions',
];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ALLIUM_API_KEY) {
    return res.status(500).json({ error: 'Allium API key not configured on server' });
  }

  const endpoint = req.query.endpoint;
  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return res.status(400).json({
      error: `Invalid endpoint. Allowed: ${ALLOWED_ENDPOINTS.join(', ')}`,
    });
  }

  try {
    const response = await fetch(`${ALLIUM_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': ALLIUM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('[Allium Proxy] Error:', err);
    return res.status(502).json({ error: 'Failed to reach Allium API' });
  }
}
