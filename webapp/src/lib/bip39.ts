/**
 * Minimal BIP-39 seed derivation using the browser Web Crypto API.
 * Does NOT validate against the official BIP-39 wordlist — use for key
 * derivation only.  A real production wallet would also verify the wordlist
 * and checksum; this is intentionally lightweight for a demo/hackathon
 * context.
 */

/**
 * Convert a BIP-39 mnemonic phrase into a 64-byte seed (Uint8Array).
 * Uses PBKDF2-HMAC-SHA512 with 2048 iterations, matching the BIP-39 spec.
 */
export async function mnemonicToSeed(
  mnemonic: string,
  passphrase = '',
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const password = encoder.encode(mnemonic.normalize('NFKD'));
  const salt = encoder.encode(('mnemonic' + passphrase).normalize('NFKD'));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    password,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 2048, hash: 'SHA-512' },
    keyMaterial,
    512, // 64 bytes
  );

  return new Uint8Array(bits);
}

/**
 * Loosely validates that a mnemonic has 12, 18, or 24 words.
 * Does not check the wordlist or checksum.
 */
export function validateMnemonicLength(mnemonic: string): boolean {
  const count = mnemonic.trim().split(/\s+/).length;
  return count === 12 || count === 18 || count === 24;
}
