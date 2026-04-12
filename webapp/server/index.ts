import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { walletEngine } from './walletEngine.js';
import { MINTS, getMintsForMode, ALLIUM_API_KEY } from './config.js';
import type { MintScore, MintConfig } from '../src/state/types.js';

const PORT = parseInt(process.env.PORT || '3456', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json());

// ── Wallet API routes ───────────────────────────────────────────────

app.get('/api/wallet/balances', (_req: Request, res: Response) => {
  const balances = walletEngine.getAllBalances();
  const total = walletEngine.getTotalBalance();
  res.json({ balances, total });
});

app.get('/api/wallet/mode', (_req: Request, res: Response) => {
  res.json({ mode: walletEngine.getMode() });
});

app.post('/api/wallet/set-mode', async (req: Request, res: Response) => {
  const { mode, mintConfigs } = req.body as {
    mode: 'mutinynet' | 'testnet' | 'mainnet';
    mintConfigs?: MintConfig[];
  };
  if (!mode) {
    res.status(400).json({ ok: false, error: 'mode is required' });
    return;
  }
  const mints = mintConfigs ?? getMintsForMode(MINTS, mode);
  const result = await walletEngine.setMode(mode, mints);
  res.json(result);
});

app.post('/api/wallet/receive', async (req: Request, res: Response) => {
  const { amount, scores } = req.body as { amount: number; scores: MintScore[] };
  if (!amount || amount <= 0) {
    res.status(400).json({ ok: false, error: 'amount must be > 0' });
    return;
  }
  const result = await walletEngine.smartReceive(amount, scores ?? []);
  res.json(result);
});

app.post('/api/wallet/poll', async (req: Request, res: Response) => {
  // Long-polling: this can block for up to 5 minutes
  res.setTimeout(360_000);
  const { mintUrl, quoteId } = req.body as { mintUrl: string; quoteId: string };
  if (!mintUrl || !quoteId) {
    res.status(400).json({ ok: false, error: 'mintUrl and quoteId are required' });
    return;
  }
  const result = await walletEngine.pollMintQuote(mintUrl, quoteId);
  if (result.ok) {
    // Don't send raw proofs to the client — they're server secrets now
    const credited = result.data.reduce((s, p) => s + p.amount, 0);
    res.json({ ok: true, data: { credited } });
  } else {
    res.json(result);
  }
});

app.post('/api/wallet/send', async (req: Request, res: Response) => {
  const { invoice, scores } = req.body as { invoice: string; scores: MintScore[] };
  if (!invoice) {
    res.status(400).json({ ok: false, error: 'invoice is required' });
    return;
  }
  const result = await walletEngine.smartSend(invoice, scores ?? []);
  res.json(result);
});

app.post('/api/wallet/migrate', async (req: Request, res: Response) => {
  const { from, to, amount, reason } = req.body as {
    from: string; to: string; amount: number; reason?: string;
  };
  if (!from || !to || !amount) {
    res.status(400).json({ ok: false, error: 'from, to, and amount are required' });
    return;
  }
  const result = await walletEngine.migrate(from, to, amount, reason);
  res.json(result);
});

// ── Allium API proxy ────────────────────────────────────────────────
// Keeps the Allium API key server-side. Replaces the Vercel serverless function.
const ALLIUM_BASE = 'https://api.allium.so/api/v1/developer';
const ALLIUM_ENDPOINTS = new Set([
  '/wallet/balances',
  '/wallet/balances/history',
  '/wallet/transactions',
  '/wallet/positions',
]);

app.post('/api/allium', async (req: Request, res: Response) => {
  const endpoint = req.query.endpoint as string;
  if (!endpoint || !ALLIUM_ENDPOINTS.has(endpoint)) {
    res.status(400).json({ error: `Invalid endpoint. Allowed: ${[...ALLIUM_ENDPOINTS].join(', ')}` });
    return;
  }
  if (!ALLIUM_API_KEY) {
    res.status(500).json({ error: 'Allium API key not configured on server' });
    return;
  }
  try {
    const response = await fetch(`${ALLIUM_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'X-API-KEY': ALLIUM_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[Allium Proxy]', err);
    res.status(502).json({ error: 'Failed to reach Allium API' });
  }
});

// ── CORS proxy for mint probing ─────────────────────────────────────
// Browser trust engine needs to probe mints (CORS blocked).
// /cashu-proxy/testnut.cashu.space/v1/info → https://testnut.cashu.space/v1/info
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use('/cashu-proxy', (req: Request, res: Response, _next: NextFunction) => {
  const target = 'https://' + req.url.slice(1); // strip leading /

  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.sendStatus(204);
    return;
  }

  // Collect body for POST requests
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(chunks).toString();
    try {
      const fetchOpts: RequestInit = {
        method: req.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
      };
      if (body && req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOpts.body = body;
      }

      const response = await fetch(target, fetchOpts);
      const responseBody = await response.arrayBuffer();

      res.set({
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.status(response.status).send(Buffer.from(responseBody));
    } catch (err) {
      console.error(`[cashu-proxy] ${req.method} ${target} →`, err);
      res.set({ 'Access-Control-Allow-Origin': '*' });
      res.status(502).json({ error: String(err) });
    }
  });
});

// ── Dev: Vite as middleware / Prod: static serving ──────────────────
async function startServer() {
  // Auto-init wallet with mutinynet mints
  console.log('[Server] Initializing wallet engine (mutinynet)…');
  await walletEngine.setMode('mutinynet', getMintsForMode(MINTS, 'mutinynet'));
  console.log('[Server] Wallet engine ready.');

  if (!IS_PROD) {
    // Dev: Vite dev server as middleware (HMR works, single process)
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Prod: serve built frontend
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback: serve index.html for all non-API routes
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Server] L3 running at http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
