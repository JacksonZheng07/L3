import { Wallet, Mint } from '@cashu/cashu-ts';
import type { Proof, MintQuoteBolt11Response, MeltQuoteBolt11Response } from '@cashu/cashu-ts';
import type { MintInfo } from '../types';

export async function createWallet(mintUrl: string): Promise<Wallet> {
  const wallet = new Wallet(mintUrl, { unit: 'sat' });
  await wallet.loadMint();
  return wallet;
}

export async function getMintInfo(mintUrl: string): Promise<MintInfo | null> {
  try {
    const mint = new Mint(mintUrl);
    const info = await mint.getInfo();
    return {
      name: info.name || 'Unknown',
      version: info.version || 'Unknown',
      description: info.description,
      contact: info.contact?.map((c) => ({
        method: String(Object.keys(c)[0] ?? 'unknown'),
        info: String(Object.values(c)[0] ?? ''),
      })) ?? [],
    };
  } catch {
    return null;
  }
}

export async function getKeysetIds(mintUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${mintUrl}/v1/keysets`);
    const data = await res.json();
    return (data.keysets ?? []).map((k: { id: string }) => k.id);
  } catch {
    return [];
  }
}

export async function requestMintQuote(
  wallet: Wallet,
  amount: number
): Promise<MintQuoteBolt11Response> {
  return wallet.createMintQuoteBolt11(amount);
}

export async function checkMintQuote(
  wallet: Wallet,
  quote: string | MintQuoteBolt11Response
): Promise<MintQuoteBolt11Response> {
  return wallet.checkMintQuoteBolt11(quote);
}

export async function mintProofs(
  wallet: Wallet,
  amount: number,
  quote: string | MintQuoteBolt11Response
): Promise<Proof[]> {
  return wallet.mintProofsBolt11(amount, quote);
}

export async function requestMeltQuote(
  wallet: Wallet,
  invoice: string
): Promise<MeltQuoteBolt11Response> {
  return wallet.createMeltQuoteBolt11(invoice);
}

export async function meltProofs(
  wallet: Wallet,
  meltQuote: MeltQuoteBolt11Response,
  proofs: Proof[]
): Promise<{ change: Proof[] }> {
  const result = await wallet.meltProofsBolt11(meltQuote, proofs);
  return { change: result.change ?? [] };
}

export function getProofsBalance(proofs: Proof[]): number {
  return proofs.reduce((sum, p) => sum + p.amount, 0);
}
