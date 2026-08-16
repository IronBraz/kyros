import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from '../server/lib/pin.js';

describe('pin hashing', () => {
  it('verifies the pin it hashed', async () => {
    const stored = await hashPin('4821');
    expect(await verifyPin('4821', stored)).toBe(true);
  });

  it('rejects a wrong pin', async () => {
    const stored = await hashPin('4821');
    expect(await verifyPin('4822', stored)).toBe(false);
    expect(await verifyPin('', stored)).toBe(false);
    expect(await verifyPin('48210', stored)).toBe(false);
  });

  it('salts, so the same pin hashes differently every time', async () => {
    const a = await hashPin('4821');
    const b = await hashPin('4821');
    expect(a).not.toBe(b);
    // ...and both still verify
    expect(await verifyPin('4821', a)).toBe(true);
    expect(await verifyPin('4821', b)).toBe(true);
  });

  it('never stores the pin in the encoded value', async () => {
    const stored = await hashPin('4821');
    expect(stored).not.toContain('4821');
    expect(stored.startsWith('scrypt$32768$8$1$')).toBe(true);
  });

  it('returns false instead of throwing on a malformed stored value', async () => {
    // One corrupt row must not take down the whole login endpoint.
    for (const bad of ['', 'plaintext-pin', 'scrypt$', 'scrypt$a$b$c$d$e', 'bcrypt$1$1$1$aa$bb']) {
      expect(await verifyPin('4821', bad)).toBe(false);
    }
  });

  it('keeps verifying hashes made with weaker cost parameters', async () => {
    // The parameters are embedded in the stored string precisely so that raising the cost
    // later does not invalidate every PIN issued before the change. This builds a hash the
    // way an older, cheaper version of hashPin() would have, and checks it still verifies.
    const scryptAsync = promisify(scrypt) as (
      password: string,
      salt: Buffer,
      keylen: number,
      options: { N: number; r: number; p: number; maxmem: number }
    ) => Promise<Buffer>;

    const N = 16384;
    const salt = randomBytes(16);
    const hash = await scryptAsync('4821', salt, 32, { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const legacy = `scrypt$${N}$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;

    expect(await verifyPin('4821', legacy)).toBe(true);
    expect(await verifyPin('9999', legacy)).toBe(false);
  });
});
