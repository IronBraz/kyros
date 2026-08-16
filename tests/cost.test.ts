import { describe, expect, it } from 'vitest';
import { costEur } from '../server/lib/openrouter.js';

describe('AI cost', () => {
  it('uses the rates measured against the live API, not the ones inherited from n8n', () => {
    // Measured 2026-08-16 with `usage: { include: true }`: 3016 prompt tokens billed
    // $0.003016 and 5 completion tokens billed $0.000025, i.e. $1.00 and $5.00 per million.
    // The n8n table said 0.80/4.00 and under-counted every call by 25%.
    // 1M in + 1M out = $6.00, times the 0.92 EUR rate = €5.52.
    expect(costEur('anthropic/claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(5.52, 6);
    expect(costEur('anthropic/claude-haiku-4-5', 3016, 5)).toBeCloseTo(0.003041 * 0.92, 5);
  });

  it('bills a realistic single turn at a fraction of a cent', () => {
    // ~3k input (wiki + persona + history), ~150 output.
    const cost = costEur('anthropic/claude-haiku-4-5', 3000, 150);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });

  it('is zero for a call that produced nothing', () => {
    expect(costEur('anthropic/claude-haiku-4-5', 0, 0)).toBe(0);
  });

  it('falls back to a pessimistic rate for an unknown model', () => {
    // An unconfigured model must never look cheaper than the ones we know, or a typo in
    // KYROS_AI_MODEL would silently under-count against the budget cap.
    const unknown = costEur('some/unreleased-model', 1_000_000, 1_000_000);
    const known = costEur('anthropic/claude-haiku-4-5', 1_000_000, 1_000_000);
    expect(unknown).toBeGreaterThan(0);
    expect(unknown).toBeGreaterThanOrEqual(known * 0.8);
  });

  it('prices the cheaper models below Haiku', () => {
    const haiku = costEur('anthropic/claude-haiku-4-5', 100_000, 10_000);
    expect(costEur('openai/gpt-4o-mini', 100_000, 10_000)).toBeLessThan(haiku);
    expect(costEur('google/gemini-flash-1.5', 100_000, 10_000)).toBeLessThan(haiku);
  });

  it('rounds to six decimals so NUMERIC(8,4) never overflows on accumulation', () => {
    const cost = costEur('google/gemini-flash-1.5', 137, 41);
    expect(String(cost).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
  });
});
