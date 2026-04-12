/**
 * Vercel Serverless Function: Cashu Mint CORS Proxy
 *
 * Proxies requests to Cashu mints to bypass browser CORS restrictions.
 * Frontend calls: /api/cashu-proxy?target=testnut.cashu.space/v1/info
 * This function forwards to: https://testnut.cashu.space/v1/info
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const target = req.query.target;
  if (!target) {
    return res.status(400).json({ error: 'target query param required' });
  }

  const url = 'https://' + target;

  try {
    const fetchOpts = {
      method: req.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
    };

    if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOpts);
    const data = await response.arrayBuffer();

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(Buffer.from(data));
  } catch (err) {
    console.error(`[cashu-proxy] ${req.method} ${url} →`, err);
    res.status(502).json({ error: String(err) });
  }
}
