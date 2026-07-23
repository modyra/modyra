/**
 * ID generation. Uses Web Crypto (`globalThis.crypto`), available in both
 * Node 19+ and browsers — the editor UI will eventually run client-side,
 * so this package must not depend on `node:crypto` (R4/R12: no framework
 * or runtime lock-in in the model layer).
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomSegment(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function createId(prefix: string): string {
  return `${prefix}_${randomSegment(12)}`;
}
