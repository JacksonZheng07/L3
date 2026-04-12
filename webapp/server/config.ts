/**
 * Server-side config — no import.meta.env (Vite-only).
 * Mirrors the subset of src/core/config.ts needed by the wallet engine.
 */

import type { MintConfig, DemoMode } from '../src/state/types.js';

export const ALLIUM_API_KEY = process.env.ALLIUM_API_KEY || '';
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
export const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '';

export const TESTNET_MINT_URL = 'https://testnut.cashu.space';
export const MUTINYNET_MINT_URL = 'https://cashu.mutinynet.com';

const TEST_MINT_URLS = new Set([TESTNET_MINT_URL, MUTINYNET_MINT_URL]);

export function getMintsForMode(allMints: MintConfig[], mode: DemoMode): MintConfig[] {
  switch (mode) {
    case 'mutinynet': {
      const found = allMints.filter((m) => m.url === MUTINYNET_MINT_URL);
      if (found.length === 0) {
        return [{ url: MUTINYNET_MINT_URL, name: 'Mutinynet Cashu', operatorAddresses: [] }];
      }
      return found;
    }
    case 'testnet': {
      const found = allMints.filter((m) => m.url === TESTNET_MINT_URL);
      if (found.length === 0) {
        return [{ url: TESTNET_MINT_URL, name: 'Testnut', operatorAddresses: [] }];
      }
      return found;
    }
    case 'mainnet':
      return allMints.filter((m) => !TEST_MINT_URLS.has(m.url));
  }
}

export const MINTS: MintConfig[] = [
  { url: 'https://mint.minibits.cash/Bitcoin', name: 'Minibits',        operatorAddresses: [] },
  { url: 'https://mint.coinos.io',             name: 'Coinos',          operatorAddresses: [] },
  { url: 'https://testnut.cashu.space',        name: 'Testnut',         operatorAddresses: [] },
  { url: 'https://cashu.mutinynet.com',        name: 'Mutinynet Cashu', operatorAddresses: [] },
  { url: 'https://mint.macadamia.cash',        name: 'Macadamia',       operatorAddresses: [] },
  { url: 'https://mint.0xchat.com',            name: '0xChat',          operatorAddresses: [] },
  { url: 'https://mint.lnvoltz.com',           name: 'LN Voltz',        operatorAddresses: [] },
];
