// Standard response envelope. Replaces the n8n SUB_Response_Standardizer sub-workflow.
// Every endpoint answers with this shape, success or failure, so the PWA can keep its
// existing `res.json().success` checks unchanged.
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export interface Meta {
  timestamp: string;
  request_id?: string;
}

export interface OkEnvelope<T> {
  success: true;
  data: T;
  meta: Meta;
}

export interface FailEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: Meta;
}

function meta(c: Context): Meta {
  const requestId = c.req.header('x-vercel-id') ?? undefined;
  return { timestamp: new Date().toISOString(), ...(requestId ? { request_id: requestId } : {}) };
}

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json<OkEnvelope<T>>({ success: true, data, meta: meta(c) }, status);
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400,
  details?: unknown
) {
  return c.json<FailEnvelope>(
    { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) }, meta: meta(c) },
    status
  );
}

/**
 * Error codes the PWA reacts to specifically. Keep these stable: changing a string here
 * silently changes frontend behaviour.
 *
 * - WIKI_NOT_LOADED  -> ChatPanel shows the "concierge unavailable" state
 * - QUEUE_CLOSED     -> LandingPage shows settings.queue.closed_message
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  ENTRY_POINT_NOT_FOUND: 'ENTRY_POINT_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  STORE_NOT_FOUND: 'STORE_NOT_FOUND',
  QUEUE_CLOSED: 'QUEUE_CLOSED',
  QUEUE_EMPTY: 'QUEUE_EMPTY',
  INVALID_PIN: 'INVALID_PIN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  WIKI_NOT_LOADED: 'WIKI_NOT_LOADED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
