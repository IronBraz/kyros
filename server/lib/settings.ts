// Store settings: shape, defaults and a deep merge that does not lose sibling keys.
//
// The n8n version did `UPDATE stores SET settings = settings || $2::jsonb`. The `||` operator
// on jsonb is a SHALLOW merge: saving only `{"queue":{"accepting_tickets":false}}` replaced
// the whole `queue` object, silently wiping closed_message, avg_service_time_minutes and the
// two timeouts. Toggling the queue from the Control Room quietly reset the rest of the panel.
//
// Fix: read the current settings, deep merge in JS, write the whole object back.

export interface QueueSettings {
  accepting_tickets: boolean;
  closed_message: string;
  avg_service_time_minutes: number;
  ghost_timeout_minutes: number;
  called_timeout_minutes: number;
}

export interface StoreSettings {
  queue: QueueSettings;
  display: { welcome_message: string; language: string };
  notifications: { call_sound: string };
  qr_base_url?: string;
}

/**
 * Defaults must match what the Control Room falls back to when a key is absent
 * (pwa/src/routes/admin/ControlRoom.tsx:141-150), otherwise the panel shows one value and
 * the backend acts on another.
 *
 * One deliberate difference: ghost_timeout_minutes is 30 here, not the 15 the frontend
 * defaults to. 15 minutes killed live sessions during long demos (CHANGELOG 1.4.0, P0-3).
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  queue: {
    accepting_tickets: true,
    closed_message: 'We are currently closed. Please come back later.',
    avg_service_time_minutes: 5,
    ghost_timeout_minutes: 30,
    called_timeout_minutes: 5,
  },
  display: {
    welcome_message: 'Welcome! You are in the queue.',
    language: 'it',
  },
  notifications: {
    call_sound: 'ding-dong',
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursive merge, `patch` winning. Arrays are replaced wholesale, not concatenated: a
 * settings array means "this is the list now", never "add to the list".
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    // An explicit null means "clear this"; undefined means "not mentioned, leave it alone".
    if (patchValue === undefined) continue;
    const baseValue = out[key];
    out[key] =
      isPlainObject(baseValue) && isPlainObject(patchValue)
        ? deepMerge(baseValue, patchValue)
        : patchValue;
  }
  return out as T;
}

/** Fills in anything the stored JSONB is missing, so callers can read fields unguarded. */
export function withDefaults(stored: unknown): StoreSettings {
  const base = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  if (!isPlainObject(stored)) return DEFAULT_SETTINGS;
  return deepMerge(base, stored) as unknown as StoreSettings;
}
