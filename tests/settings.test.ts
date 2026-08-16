import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, deepMerge, withDefaults } from '../server/lib/settings.js';

describe('settings deep merge', () => {
  it('keeps sibling keys when only one nested field is saved', () => {
    // This is the bug the n8n `settings || $2::jsonb` shallow merge caused: toggling the
    // queue off wiped closed_message and every timeout in the same object.
    const stored = {
      queue: {
        accepting_tickets: true,
        closed_message: 'Back at 3pm',
        avg_service_time_minutes: 7,
        ghost_timeout_minutes: 30,
        called_timeout_minutes: 5,
      },
      display: { welcome_message: 'Ciao', language: 'it' },
    };

    const merged = deepMerge(stored, { queue: { accepting_tickets: false } });

    expect(merged.queue).toEqual({
      accepting_tickets: false,
      closed_message: 'Back at 3pm',
      avg_service_time_minutes: 7,
      ghost_timeout_minutes: 30,
      called_timeout_minutes: 5,
    });
    expect(merged.display).toEqual({ welcome_message: 'Ciao', language: 'it' });
  });

  it('does not mutate the stored object', () => {
    const stored = { queue: { accepting_tickets: true } };
    const merged = deepMerge(stored, { queue: { accepting_tickets: false } });
    expect(stored.queue.accepting_tickets).toBe(true);
    expect(merged.queue.accepting_tickets).toBe(false);
  });

  it('replaces arrays instead of concatenating them', () => {
    const merged = deepMerge({ tags: ['a', 'b'] }, { tags: ['c'] });
    expect(merged.tags).toEqual(['c']);
  });

  it('treats undefined as "not mentioned" and null as "clear it"', () => {
    const stored = { a: 1, b: 2 };
    expect(deepMerge(stored, { a: undefined })).toEqual({ a: 1, b: 2 });
    expect(deepMerge(stored, { a: null })).toEqual({ a: null, b: 2 });
  });

  it('adds keys the stored object never had', () => {
    const merged = deepMerge({ queue: { accepting_tickets: true } }, { notifications: { call_sound: 'chime' } });
    expect(merged).toEqual({
      queue: { accepting_tickets: true },
      notifications: { call_sound: 'chime' },
    });
  });
});

describe('withDefaults', () => {
  it('fills in everything a store has never configured', () => {
    expect(withDefaults({})).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults('not an object')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values and only fills the gaps', () => {
    const result = withDefaults({ queue: { avg_service_time_minutes: 12 } });
    expect(result.queue.avg_service_time_minutes).toBe(12);
    expect(result.queue.ghost_timeout_minutes).toBe(30);
    expect(result.display.language).toBe('it');
  });

  it('defaults the ghost timeout to 30 minutes, not 15', () => {
    // 15 killed live sessions during long demos (CHANGELOG 1.4.0, P0-3).
    expect(withDefaults({}).queue.ghost_timeout_minutes).toBe(30);
  });
});
