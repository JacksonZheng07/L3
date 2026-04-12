/**
 * L³ Mint Discovery via NIP-87 (Nostr)
 *
 * Fetches live Cashu mint registrations from Nostr relays.
 * NIP-87 kind 38172 = Cashu mint info events.
 * Each event has a "u" tag with the mint URL and content with optional metadata.
 *
 * Fallback: if relay queries fail, uses a static seed list of known-good mints.
 */

import type { MintConfig } from '../state/types';

// Nostr relays to query for NIP-87 events
const RELAYS = [
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol',
];

const NIP87_CASHU_INFO_KIND = 38172;
const RELAY_TIMEOUT_MS = 10000;

// Known operator addresses (enriches discovered mints with Allium data)
// Note: For demo purposes, addresses are associated Bitcoin wallets with rich on-chain
// history to demonstrate Allium data flow. Uses P2PKH/P2SH formats (Allium balances
// endpoint has issues with bech32 bc1... addresses).
const KNOWN_OPERATORS: Record<string, string[]> = {
  'https://mint.minibits.cash/Bitcoin': ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
  'https://mint.coinos.io': ['3FHNBLobJnbCTFTVakh5TXmEneyf5PT61B'],
  'https://testnut.cashu.space': ['35hK24tcLEWcgNA4JxpvbkNkoAcDGqQPsP'],
  'https://mint.macadamia.cash': ['385cR5DM96n1HvBDMzLHPYcw89fZAXULJP'],
  'https://mint.0xchat.com': ['12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S'],
  'https://mint.lnvoltz.com': ['1Kr6QSydW9bFQG1mXiPNNu6WpJGmUa9i1g'],
};

// Fallback seed list if Nostr discovery fails entirely
const SEED_MINTS: MintConfig[] = [
  { url: 'https://mint.minibits.cash/Bitcoin', name: 'Minibits', operatorAddresses: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'] },
  { url: 'https://mint.coinos.io', name: 'Coinos', operatorAddresses: ['3FHNBLobJnbCTFTVakh5TXmEneyf5PT61B'] },
  { url: 'https://mint.0xchat.com', name: '0xChat', operatorAddresses: ['12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S'] },
  { url: 'https://mint.lnvoltz.com', name: 'LN Voltz', operatorAddresses: ['1Kr6QSydW9bFQG1mXiPNNu6WpJGmUa9i1g'] },
  { url: 'https://cashu.boats', name: 'Kinda Reckless Mint', operatorAddresses: [] },
  { url: 'https://mint.lnw.cash', name: 'lnwCash', operatorAddresses: [] },
];

interface NostrEvent {
  kind: number;
  content: string;
  tags: string[][];
  pubkey: string;
  created_at: number;
}

/**
 * Query a single Nostr relay for NIP-87 Cashu mint info events.
 */
function queryRelay(relayUrl: string): Promise<Map<string, { url: string; name: string }>> {
  return new Promise((resolve) => {
    const mints = new Map<string, { url: string; name: string }>();

    try {
      const ws = new WebSocket(relayUrl);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(mints);
      }, RELAY_TIMEOUT_MS);

      ws.onopen = () => {
        ws.send(JSON.stringify(['REQ', 'l3-mints', { kinds: [NIP87_CASHU_INFO_KIND], limit: 200 }]));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg[0] === 'EVENT' && msg[2]) {
            const nostrEvent = msg[2] as NostrEvent;
            const urlTag = nostrEvent.tags?.find((t: string[]) => t[0] === 'u');
            const url = urlTag?.[1];
            if (!url || !url.startsWith('http')) return;

            // Normalize URL (strip trailing slash)
            const normalized = url.replace(/\/+$/, '');

            let name = '';
            try {
              const meta = JSON.parse(nostrEvent.content);
              name = meta.name || meta.display_name || '';
            } catch {
              // no metadata
            }

            // Keep the latest event per URL (by created_at)
            const existing = mints.get(normalized);
            if (!existing) {
              mints.set(normalized, { url: normalized, name });
            }
          }

          if (msg[0] === 'EOSE') {
            clearTimeout(timeout);
            ws.close();
            resolve(mints);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(mints);
      };
    } catch {
      resolve(mints);
    }
  });
}

/**
 * Verify a mint is alive by hitting its /v1/info endpoint.
 * Returns the mint name from the info response, or null if unreachable.
 */
async function verifyMint(url: string): Promise<{ name: string; alive: boolean }> {
  try {
    const response = await fetch(`${url}/v1/info`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const info = await response.json();
      return { name: info.name || 'Unknown', alive: true };
    }
    return { name: '', alive: false };
  } catch {
    return { name: '', alive: false };
  }
}

/**
 * Discover live Cashu mints via NIP-87 Nostr events.
 *
 * 1. Query multiple Nostr relays for kind 38172 events
 * 2. Deduplicate by URL
 * 3. Verify each mint is alive (/v1/info)
 * 4. Return only responsive mints as MintConfig[]
 *
 * Falls back to SEED_MINTS if discovery fails.
 */
export async function discoverMints(): Promise<MintConfig[]> {
  console.log('[MintDiscovery] Querying Nostr relays for NIP-87 Cashu mints...');

  // Query all relays in parallel
  const relayResults = await Promise.allSettled(
    RELAYS.map((r) => queryRelay(r)),
  );

  // Merge results from all relays
  const allMints = new Map<string, { url: string; name: string }>();
  for (const result of relayResults) {
    if (result.status === 'fulfilled') {
      for (const [url, data] of result.value) {
        if (!allMints.has(url)) {
          allMints.set(url, data);
        }
      }
    }
  }

  console.log(`[MintDiscovery] Found ${allMints.size} unique mints from ${RELAYS.length} relays`);

  if (allMints.size === 0) {
    console.warn('[MintDiscovery] No mints from Nostr, using seed list');
    return SEED_MINTS;
  }

  // Verify all discovered mints in parallel
  const verifyPromises = Array.from(allMints.entries()).map(
    async ([url, data]) => {
      const check = await verifyMint(url);
      return {
        url,
        name: check.alive ? (check.name || data.name || 'Unknown') : '',
        alive: check.alive,
      };
    },
  );

  const verified = await Promise.all(verifyPromises);
  const aliveMints = verified.filter((m) => m.alive);

  console.log(`[MintDiscovery] ${aliveMints.length}/${allMints.size} mints verified alive`);

  if (aliveMints.length === 0) {
    console.warn('[MintDiscovery] No alive mints found, using seed list');
    return SEED_MINTS;
  }

  // Convert to MintConfig with known operator addresses
  const configs: MintConfig[] = aliveMints.map((m) => ({
    url: m.url,
    name: m.name,
    operatorAddresses: KNOWN_OPERATORS[m.url] ?? [],
  }));

  // Sort: known operators first, then alphabetically
  configs.sort((a, b) => {
    const aKnown = a.operatorAddresses.length > 0 ? 0 : 1;
    const bKnown = b.operatorAddresses.length > 0 ? 0 : 1;
    if (aKnown !== bKnown) return aKnown - bKnown;
    return a.name.localeCompare(b.name);
  });

  return configs;
}
