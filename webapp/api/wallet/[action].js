/**
 * Vercel Serverless Function: Wallet API
 *
 * Handles all /api/wallet/* routes. The wallet engine lives at module scope
 * so it persists across warm invocations (~5-15 min on Vercel).
 * On cold starts proofs are restored from Vercel Blob.
 *
 * Routes:
 *   GET  /api/wallet/mode       → current demo mode
 *   GET  /api/wallet/balances   → all balances
 *   POST /api/wallet/set-mode   → switch network mode
 *   POST /api/wallet/receive    → generate Lightning invoice
 *   POST /api/wallet/poll       → poll for payment
 *   POST /api/wallet/send       → pay Lightning invoice
 *   POST /api/wallet/migrate    → move funds between mints
 */

import { Mint, Wallet, MintQuoteState } from '@cashu/cashu-ts';
import { put, get } from '@vercel/blob';

// ── Mint configs ────────────────────────────────────────────────────
const TESTNET_MINT_URL = 'https://testnut.cashu.space';
const MUTINYNET_MINT_URL = 'https://cashu.mutinynet.com';
const TEST_MINT_URLS = new Set([TESTNET_MINT_URL, MUTINYNET_MINT_URL]);

const MINTS = [
  { url: 'https://mint.minibits.cash/Bitcoin', name: 'Minibits' },
  { url: 'https://mint.coinos.io',             name: 'Coinos' },
  { url: 'https://testnut.cashu.space',        name: 'Testnut' },
  { url: 'https://cashu.mutinynet.com',        name: 'Mutinynet Cashu' },
  { url: 'https://mint.macadamia.cash',        name: 'Macadamia' },
  { url: 'https://mint.0xchat.com',            name: '0xChat' },
  { url: 'https://mint.lnvoltz.com',           name: 'LN Voltz' },
  { url: 'https://cashu.boats',                name: 'Kinda Reckless Mint' },
];

function getMintsForMode(mode) {
  switch (mode) {
    case 'mutinynet': {
      const found = MINTS.filter((m) => m.url === MUTINYNET_MINT_URL);
      return found.length ? found : [{ url: MUTINYNET_MINT_URL, name: 'Mutinynet Cashu' }];
    }
    case 'testnet': {
      const found = MINTS.filter((m) => m.url === TESTNET_MINT_URL);
      return found.length ? found : [{ url: TESTNET_MINT_URL, name: 'Testnut' }];
    }
    case 'mainnet':
      return MINTS.filter((m) => !TEST_MINT_URLS.has(m.url));
    default:
      return MINTS;
  }
}

// ── Module-scope wallet state (survives warm invocations) ───────────
let currentMode = 'mutinynet';
let wallets = new Map();   // url → Wallet instance
let proofs = new Map();    // url → Proof[]
let initialized = false;
let initPromise = null;

// ── Blob persistence ────────────────────────────────────────────────
// Proofs ARE the money — losing them = losing funds. Save to Vercel Blob
// after every mutation so cold starts don't wipe balances.
const PROOFS_BLOB_KEY = 'wallet/proofs.json';

async function saveProofsToBlob() {
  try {
    const data = {};
    for (const [url, ps] of proofs) {
      if (ps.length > 0) data[url] = ps;
    }
    await put(PROOFS_BLOB_KEY, JSON.stringify({ mode: currentMode, proofs: data }), {
      access: 'public',
      addRandomSuffix: false,
    });
  } catch (err) {
    console.error('[Wallet] Failed to save proofs to Blob:', err.message);
  }
}

async function loadProofsFromBlob() {
  try {
    const response = await get(PROOFS_BLOB_KEY, { access: 'public' });
    if (!response) return null;
    const text = await response.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn('[Wallet] No saved proofs found:', err.message);
    return null;
  }
}

function mintName(url) {
  const entry = MINTS.find((m) => m.url === url);
  return entry?.name ?? url;
}

async function ensureInit(mode, mintConfigs) {
  // Allow reinit if new mintConfigs are provided (NIP-87 discovered new mints)
  const hasNewMints = mintConfigs && mintConfigs.some((c) => !wallets.has(c.url));
  if (initialized && mode === currentMode && !hasNewMints) return;

  // If already initializing, wait for it
  if (initPromise && mode === currentMode && !hasNewMints) {
    await initPromise;
    return;
  }

  currentMode = mode;
  const configs = mintConfigs || getMintsForMode(mode);

  initPromise = (async () => {
    const oldWallets = wallets;
    const oldProofs = proofs;
    wallets = new Map();
    proofs = new Map();

    // On cold start, restore proofs from Blob storage
    let savedProofs = {};
    if (oldProofs.size === 0) {
      const saved = await loadProofsFromBlob();
      if (saved && saved.proofs) {
        savedProofs = saved.proofs;
        console.log(`[Wallet] Restored proofs from Blob for ${Object.keys(savedProofs).length} mints`);
      }
    }

    const tasks = configs.map(async (cfg) => {
      // Reuse existing wallet instance if we have one
      if (oldWallets.has(cfg.url)) {
        wallets.set(cfg.url, oldWallets.get(cfg.url));
        proofs.set(cfg.url, oldProofs.get(cfg.url) || savedProofs[cfg.url] || []);
        return;
      }
      try {
        const mint = new Mint(cfg.url);
        const wallet = new Wallet(mint);
        await wallet.loadMint();
        wallets.set(cfg.url, wallet);
        proofs.set(cfg.url, oldProofs.get(cfg.url) || savedProofs[cfg.url] || []);
      } catch (err) {
        console.warn(`[Wallet] Failed to init ${cfg.name || cfg.url}:`, err.message);
      }
    });

    await Promise.allSettled(tasks);
    initialized = true;
    console.log(`[Wallet] Init complete: ${wallets.size}/${configs.length} mints (${mode})`);
  })();

  await initPromise;
  initPromise = null;
}

function getBalance(url) {
  return (proofs.get(url) || []).reduce((s, p) => s + p.amount, 0);
}

function getAllBalances() {
  const balances = [];
  for (const [url, ps] of proofs) {
    const balance = ps.reduce((s, p) => s + p.amount, 0);
    if (balance > 0) balances.push({ mintUrl: url, mintName: mintName(url), balance });
  }
  const total = balances.reduce((s, b) => s + b.balance, 0);
  return { balances, total };
}

// ── Handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    // Auto-init on first request
    if (!initialized) {
      await ensureInit('mutinynet');
    }

    switch (action) {
      case 'mode':
        return res.json({ mode: currentMode });

      case 'balances':
        return res.json(getAllBalances());

      case 'set-mode': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { mode, mintConfigs } = req.body || {};
        if (!mode) return res.status(400).json({ ok: false, error: 'mode is required' });
        await ensureInit(mode, mintConfigs);
        return res.json({ ok: true, data: undefined });
      }

      case 'receive': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { amount, scores } = req.body || {};
        if (!amount || amount <= 0) return res.status(400).json({ ok: false, error: 'amount must be > 0' });

        // Pick best mint from scores, fall back to any connected
        const eligible = (scores || [])
          .filter((s) => s.isOnline && s.grade !== 'critical' && wallets.has(s.url))
          .sort((a, b) => b.compositeScore - a.compositeScore);

        const candidates = eligible.length > 0
          ? eligible.map((s) => s.url)
          : Array.from(wallets.keys());

        for (const url of candidates) {
          try {
            const wallet = wallets.get(url);
            if (!wallet) continue;
            const quote = await wallet.createMintQuoteBolt11(amount);
            return res.json({ ok: true, data: { quote: quote.quote, request: quote.request, mintUrl: url } });
          } catch (err) {
            console.warn(`[Wallet] receive failed on ${mintName(url)}:`, err.message);
          }
        }
        return res.json({ ok: false, error: 'No connected mints could generate an invoice' });
      }

      case 'poll': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { mintUrl, quoteId } = req.body || {};
        if (!mintUrl || !quoteId) return res.status(400).json({ ok: false, error: 'mintUrl and quoteId required' });

        const wallet = wallets.get(mintUrl);
        if (!wallet) return res.json({ ok: false, error: `No wallet for ${mintUrl}` });

        for (let i = 0; i < 18; i++) {
          const status = await wallet.checkMintQuoteBolt11(quoteId);
          if (status.state === MintQuoteState.PAID || status.state === MintQuoteState.ISSUED) {
            const newProofs = await wallet.mintProofsBolt11(status.amount, quoteId);
            const existing = proofs.get(mintUrl) || [];
            proofs.set(mintUrl, [...existing, ...newProofs]);
            await saveProofsToBlob();
            const credited = newProofs.reduce((s, p) => s + p.amount, 0);
            return res.json({ ok: true, data: { credited } });
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
        return res.json({ ok: false, error: 'Timeout — payment not received yet. Try polling again.' });
      }

      case 'send': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { invoice, scores: sendScores } = req.body || {};
        if (!invoice) return res.status(400).json({ ok: false, error: 'invoice required' });

        // Find a funded mint (prefer riskiest first to drain)
        const ranked = (sendScores || [])
          .filter((s) => s.isOnline && wallets.has(s.url))
          .sort((a, b) => a.compositeScore - b.compositeScore); // riskiest first

        const fundedCandidates = ranked.length > 0
          ? ranked.map((s) => s.url)
          : Array.from(wallets.keys());

        for (const url of fundedCandidates) {
          const bal = getBalance(url);
          if (bal <= 0) continue;
          try {
            const wallet = wallets.get(url);
            const mintProofs = proofs.get(url) || [];
            const meltQuote = await wallet.createMeltQuoteBolt11(invoice);
            const needed = meltQuote.amount + meltQuote.fee_reserve;
            if (bal < needed) continue;
            const { keep, send: toSend } = wallet.selectProofsToSend(mintProofs, needed, true);
            const meltResult = await wallet.meltProofsBolt11(meltQuote, toSend);
            proofs.set(url, [...keep, ...meltResult.change]);
            await saveProofsToBlob();
            const paid = meltResult.quote.state === 'PAID';
            return res.json({ ok: true, data: { paid, preimage: meltResult.quote.payment_preimage, usedMints: [url] } });
          } catch (err) {
            console.warn(`[Wallet] send failed on ${mintName(url)}:`, err.message);
          }
        }
        return res.json({ ok: false, error: 'No mint could pay this invoice' });
      }

      case 'migrate': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { from, to, amount: migAmount, reason } = req.body || {};
        if (!from || !to || !migAmount) return res.status(400).json({ ok: false, error: 'from, to, amount required' });

        const sourceWallet = wallets.get(from);
        const targetWallet = wallets.get(to);
        if (!sourceWallet || !targetWallet) return res.json({ ok: false, error: `Wallet not found for ${!sourceWallet ? from : to}` });

        try {
          const mintQuote = await targetWallet.createMintQuoteBolt11(migAmount);
          const sourceProofs = proofs.get(from) || [];
          const meltQuote = await sourceWallet.createMeltQuoteBolt11(mintQuote.request);
          const needed = meltQuote.amount + meltQuote.fee_reserve;
          const { keep, send: toSend } = sourceWallet.selectProofsToSend(sourceProofs, needed, true);
          const meltResult = await sourceWallet.meltProofsBolt11(meltQuote, toSend);
          proofs.set(from, [...keep, ...meltResult.change]);
          const newProofs = await targetWallet.mintProofsBolt11(migAmount, mintQuote.quote);
          const existing = proofs.get(to) || [];
          proofs.set(to, [...existing, ...newProofs]);
          await saveProofsToBlob();

          return res.json({
            ok: true,
            data: {
              id: crypto.randomUUID(),
              fromMint: from, toMint: to, amount: migAmount,
              reason: reason || 'migration',
              timestamp: new Date().toISOString(),
              status: 'completed',
            },
          });
        } catch (err) {
          return res.json({ ok: false, error: `migrate: ${err.message}` });
        }
      }

      default:
        return res.status(404).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[Wallet] ${action} error:`, err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
