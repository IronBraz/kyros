// Admin PIN hashing. Replaces `admin_access.access_code` storing the PIN in plaintext.
//
// scrypt from node:crypto, no dependency: it is memory-hard, so a stolen database does not
// hand an attacker the PINs, and it works on Vercel without native modules.
//
// Format stored in admin_access.access_code_hash:
//     scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>
// The parameters are embedded so hashes made today keep verifying after we raise the cost.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// N=2^15 keeps a single verify around 50-100ms on Vercel's Node runtime: slow enough to
// make offline cracking expensive, fast enough not to be felt on a login.
const PARAMS = { N: 32768, r: 8, p: 1 } as const;
const KEYLEN = 32;
// scrypt needs roughly 128 * N * r bytes; Node's 32MB default is not enough at N=2^15.
const MAXMEM = 64 * 1024 * 1024;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin.normalize('NFKC'), salt, KEYLEN, { ...PARAMS, maxmem: MAXMEM });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Constant-time verify. Returns false rather than throwing on a malformed stored value, so
 * one corrupt row cannot take down the whole login endpoint.
 */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts as [
    string, string, string, string, string, string,
  ];
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scrypt(pin.normalize('NFKC'), salt, expected.length, { N, r, p, maxmem: MAXMEM });
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch, which would itself leak the length.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
