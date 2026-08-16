// Admin session tokens.
//
// Under n8n there was no authentication at all: every webhook was `authentication: none`,
// SUB_Auth_Manager returned `authorized: true` hardcoded and nobody called it, and the
// frontend never sent the X-Admin-Session header the spec asked for. Anyone who knew the
// URL could run the queue.
//
// Format:  base64url(payload) "." base64url(HMAC-SHA256(payload, KYROS_SESSION_SECRET))
//
// Not a full JWT on purpose. A JWT would add a dependency and an algorithm field, and the
// `alg: none` family of mistakes with it. Here there is exactly one algorithm and it is not
// negotiable by the token.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { config, requireEnv } from './config.js';
import { ErrorCode, fail } from './respond.js';

export interface AdminSession {
  /** admin_access.id -- which PIN was used. */
  aid: string;
  /** The store this session may touch. The whole point of the token. */
  sid: string;
  /** Tenant, for queries that scope by brand. */
  tid: string;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sign(payloadB64: string): string {
  return b64url(createHmac('sha256', requireEnv('KYROS_SESSION_SECRET')).update(payloadB64).digest());
}

export function mintToken(session: Omit<AdminSession, 'exp'>, ttlSeconds = config.adminSessionSeconds): {
  token: string;
  expiresAt: Date;
} {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: AdminSession = { ...session, exp };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return {
    token: `${payloadB64}.${sign(payloadB64)}`,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Returns the session, or null for anything wrong: bad shape, bad signature, expired.
 * Never throws and never distinguishes the reasons to the caller -- a forger learns nothing
 * from the response about which part they got wrong.
 */
export function verifyToken(token: string | undefined): AdminSession | null {
  if (!token) return null;

  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;

  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let expectedSig: string;
  try {
    expectedSig = sign(payloadB64);
  } catch {
    // KYROS_SESSION_SECRET missing. Refuse everything rather than let anyone in.
    console.error('[kyros] KYROS_SESSION_SECRET is not set: rejecting all admin sessions');
    return null;
  }

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  // Length check first: timingSafeEqual throws on a mismatch, and the throw would itself
  // be an observable difference.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: AdminSession;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AdminSession;
  } catch {
    return null;
  }

  if (
    typeof payload?.aid !== 'string' ||
    typeof payload?.sid !== 'string' ||
    typeof payload?.tid !== 'string' ||
    typeof payload?.exp !== 'number'
  ) {
    return null;
  }
  if (payload.exp * 1000 <= Date.now()) return null;

  return payload;
}

declare module 'hono' {
  interface ContextVariableMap {
    adminSession: AdminSession;
  }
}

/**
 * Guards every admin route except the two public ones (auth/verify, auth/stores).
 *
 * On success it puts the session in the context, and from then on handlers take store_id
 * from `c.get('adminSession').sid` -- never from the query string or body. That single rule
 * is what closes the IDOR: previously
 * `GET /admin/queue/status?store_id=<any uuid>` returned another store's queue.
 */
export const adminGuard: MiddlewareHandler = async (c, next) => {
  const session = verifyToken(c.req.header('X-Admin-Session'));
  if (!session) {
    return fail(c, ErrorCode.UNAUTHORIZED, 'Missing, invalid or expired admin session', 401);
  }
  c.set('adminSession', session);
  await next();
};

/** The store the request is allowed to act on. Not negotiable by the caller. */
export function sessionStoreId(c: Context): string {
  return c.get('adminSession').sid;
}

/** The tenant the request belongs to. Needed to scope brand-wide rows. */
export function sessionTenantId(c: Context): string {
  return c.get('adminSession').tid;
}

/**
 * Stable pseudonym for a client IP, used as a rate-limit bucket key.
 *
 * Keyed with the session secret so the value is useless outside this deployment, and
 * truncated because we only need a bucket, not an identifier. Storing raw IPs would be a
 * data-retention problem for no benefit (specs/09_Security_Privacy.md).
 */
export function hashIp(ip: string): string {
  try {
    return createHmac('sha256', requireEnv('KYROS_SESSION_SECRET')).update(ip).digest('hex').slice(0, 16);
  } catch {
    // No secret: fall back to one shared bucket. Stricter than per-IP, never looser.
    return 'nosecret';
  }
}

/** Best-effort client IP. On Vercel the left-most x-forwarded-for entry is the real client. */
export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  return first || c.req.header('x-real-ip') || 'unknown';
}
