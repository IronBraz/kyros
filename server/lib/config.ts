// Every environment-dependent value, read in exactly one place.
//
// Under n8n the same constants were scattered: the €3 budget cap lived in SUB_Budget_Check,
// in API_Admin_AIUsage and again in pwa/src/components/admin/AIUsageCard.tsx, so changing it
// meant changing three files and hoping. Now the API returns cap_eur and the frontend reads
// it back.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.warn(`[kyros] ${name}="${raw}" is not a number, falling back to ${fallback}`);
    return fallback;
  }
  return parsed;
}

export const config = {
  /** Hard monthly ceiling on AI spend. Once reached the concierge answers a canned line. */
  aiBudgetEur: num('KYROS_AI_BUDGET_EUR', 3.0),

  /** Model id as OpenRouter names it. */
  aiModel: process.env.KYROS_AI_MODEL ?? 'anthropic/claude-haiku-4-5',

  /** Public origin, used to build entry-point QR URLs as <publicUrl>/q/<slug>. */
  publicUrl: (process.env.KYROS_PUBLIC_URL ?? 'https://kyros.neuroforge.club').replace(/\/+$/, ''),

  /** Max assistant turns per conversation before the concierge politely wraps up. */
  chatTurnCap: num('KYROS_CHAT_TURN_CAP', 30),

  /** Admin session lifetime. 8 hours, same as the n8n-era localStorage expiry. */
  adminSessionSeconds: num('KYROS_ADMIN_SESSION_SECONDS', 8 * 60 * 60),

  /** How often the lazy janitor is allowed to actually run, in seconds. */
  janitorMinIntervalSeconds: num('KYROS_JANITOR_INTERVAL_SECONDS', 60),
} as const;

/** Throws at call time, not import time, so a missing secret surfaces inside a request. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
