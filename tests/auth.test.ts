import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mintToken, verifyToken } from '../server/lib/auth.js';

const SECRET = 'test-secret-not-used-anywhere-real';
const original = process.env.KYROS_SESSION_SECRET;

beforeAll(() => {
  process.env.KYROS_SESSION_SECRET = SECRET;
});
afterAll(() => {
  if (original === undefined) delete process.env.KYROS_SESSION_SECRET;
  else process.env.KYROS_SESSION_SECRET = original;
});

const session = { aid: 'admin-1', sid: 'store-a', tid: 'tenant-1' };

describe('admin session tokens', () => {
  it('round-trips the claims', () => {
    const { token, expiresAt } = mintToken(session);
    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sid).toBe('store-a');
    expect(verified?.tid).toBe('tenant-1');
    expect(verified?.aid).toBe('admin-1');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a token whose payload was edited to point at another store', () => {
    // The whole reason the token is signed. Swapping sid must invalidate the signature,
    // otherwise anyone could mint themselves access to any store.
    const { token } = mintToken(session);
    const [payloadB64, sig] = token.split('.') as [string, string];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    payload.sid = 'store-b';
    const forged = `${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}.${sig}`;

    expect(verifyToken(forged)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const { token } = mintToken(session);
    expect(verifyToken(`${token.slice(0, -1)}X`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const { token } = mintToken(session, -1);
    expect(verifyToken(token)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const { token } = mintToken(session);
    process.env.KYROS_SESSION_SECRET = 'a-different-secret';
    expect(verifyToken(token)).toBeNull();
    process.env.KYROS_SESSION_SECRET = SECRET;
  });

  it('rejects malformed input instead of throwing', () => {
    for (const bad of [undefined, '', '.', 'nodot', 'a.', '.b', 'not.base64url!!', 'a.b.c']) {
      expect(verifyToken(bad)).toBeNull();
    }
  });

  it('rejects everything when the secret is missing', () => {
    // Fail closed: no signing key must mean nobody gets in, not everybody.
    const { token } = mintToken(session);
    delete process.env.KYROS_SESSION_SECRET;
    expect(verifyToken(token)).toBeNull();
    process.env.KYROS_SESSION_SECRET = SECRET;
  });

  it('does not encrypt the payload, so nothing secret may go in it', () => {
    // Documents the design: the payload is signed, not hidden. Anyone can read it.
    const { token } = mintToken(session);
    const decoded = Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8');
    expect(JSON.parse(decoded)).toMatchObject({ sid: 'store-a' });
  });
});
