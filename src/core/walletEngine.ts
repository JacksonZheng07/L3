import { Wallet, type Proof } from '@cashu/cashu-ts';
import { eventBus } from './eventBus';

// ─── Wallet instances (module-level, not in React state) ─────
const wallets: Map<string, Wallet> = new Map();

// ─── Initialize a mint connection ────────────────────────────
export async function initMint(mintUrl: string): Promise<Wallet> {
  if (wallets.has(mintUrl)) return wallets.get(mintUrl)!;

  const wallet = new Wallet(mintUrl);
  await wallet.loadMint();
  wallets.set(mintUrl, wallet);
  return wallet;
}

export function getWallet(mintUrl: string): Wallet {
  const w = wallets.get(mintUrl);
  if (!w) throw new Error(`No wallet initialized for ${mintUrl}`);
  return w;
}

// ─── Receive: Approach A (mint quote flow, no LNbits needed) ─

export async function createMintQuote(
  mintUrl: string,
  amountSats: number
): Promise<{ quoteId: string; invoice: string }> {
  const wallet = getWallet(mintUrl);
  const quote = await wallet.createMintQuote(amountSats);
  return {
    quoteId: quote.quote,
    invoice: quote.request,
  };
}

export async function checkMintQuoteStatus(
  mintUrl: string,
  quoteId: string
): Promise<boolean> {
  const wallet = getWallet(mintUrl);
  const status = await wallet.checkMintQuote(quoteId);
  // Handle different cashu-ts versions
  return (status as any).state === 'PAID' || (status as any).paid === true;
}

export async function claimMintedProofs(
  mintUrl: string,
  amountSats: number,
  quoteId: string
): Promise<Proof[]> {
  const wallet = getWallet(mintUrl);
  const proofs = await wallet.mintProofs(amountSats, quoteId);

  eventBus.publish({
    type: 'PROOFS_UPDATED',
    mintUrl,
    proofs,
  });

  return proofs;
}

// ─── Send: Melt tokens to pay a Lightning invoice ────────────
export async function meltTokens(
  mintUrl: string,
  proofs: Proof[],
  invoice: string
): Promise<{ paid: boolean; change: Proof[] }> {
  const wallet = getWallet(mintUrl);

  const meltQuote = await wallet.createMeltQuote(invoice);
  const result = await wallet.meltProofs(meltQuote, proofs);

  return {
    paid: result.quote.state === 'PAID',
    change: result.change ?? [],
  };
}

// ─── Fetch mint info (used by trust engine) ──────────────────
export async function fetchMintInfo(mintUrl: string): Promise<{
  name?: string;
  version?: string;
  contact?: Array<{ method: string; info: string }>;
} | null> {
  try {
    const response = await fetch(`${mintUrl}/v1/info`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ─── Fetch mint keysets (used by trust engine) ───────────────
export async function fetchMintKeysets(
  mintUrl: string
): Promise<string[] | null> {
  try {
    const response = await fetch(`${mintUrl}/v1/keysets`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.keysets?.map((k: { id: string }) => k.id) ?? [];
  } catch {
    return null;
  }
}
