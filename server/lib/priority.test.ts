import { describe, it, expect } from 'vitest';
import { calculatePriorityScore } from './priority.js';
import type { PriorityInput } from './priority.js';

/** Helper: returns an ISO date string offset from today by `days` days. */
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Baseline task with no urgency — reviewed today, no deadline, neutral EF. */
function baseTask(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    nextReview: daysFromNow(1), // tomorrow — not overdue
    deadline: null,
    easeFactor: 2.5,
    lastReviewed: daysFromNow(0), // today — fresh
    createdAt: daysFromNow(0),
    ...overrides,
  };
}

describe('calculatePriorityScore', () => {
  // ── overdueUrgency (weight 0.30) ──────────────────────────────

  describe('overdueUrgency factor', () => {
    it('returns 0 when task is not overdue', () => {
      const result = calculatePriorityScore(baseTask({ nextReview: daysFromNow(3) }));
      expect(result.factors.overdueUrgency).toBe(0);
    });

    it('returns 0 when nextReview is today', () => {
      const result = calculatePriorityScore(baseTask({ nextReview: daysFromNow(0) }));
      expect(result.factors.overdueUrgency).toBe(0);
    });

    it('scales at 15 per day overdue', () => {
      const result = calculatePriorityScore(baseTask({ nextReview: daysFromNow(-2) }));
      expect(result.factors.overdueUrgency).toBe(30);
    });

    it('caps at 100 when highly overdue', () => {
      const result = calculatePriorityScore(baseTask({ nextReview: daysFromNow(-10) }));
      expect(result.factors.overdueUrgency).toBe(100);
    });
  });

  // ── deadlinePressure (weight 0.25) ────────────────────────────

  describe('deadlinePressure factor', () => {
    it('returns 0 when no deadline', () => {
      const result = calculatePriorityScore(baseTask({ deadline: null }));
      expect(result.factors.deadlinePressure).toBe(0);
    });

    it('returns 100 when deadline is today', () => {
      const result = calculatePriorityScore(baseTask({ deadline: daysFromNow(0) }));
      expect(result.factors.deadlinePressure).toBe(100);
    });

    it('returns 50 when deadline is 5 days away', () => {
      const result = calculatePriorityScore(baseTask({ deadline: daysFromNow(5) }));
      expect(result.factors.deadlinePressure).toBe(50);
    });

    it('returns 0 when deadline is 10+ days away', () => {
      const result = calculatePriorityScore(baseTask({ deadline: daysFromNow(10) }));
      expect(result.factors.deadlinePressure).toBe(0);
    });

    it('clamps to 0 when deadline is far in the future', () => {
      const result = calculatePriorityScore(baseTask({ deadline: daysFromNow(30) }));
      expect(result.factors.deadlinePressure).toBe(0);
    });

    it('returns 100 when deadline has passed', () => {
      const result = calculatePriorityScore(baseTask({ deadline: daysFromNow(-2) }));
      expect(result.factors.deadlinePressure).toBe(100);
    });
  });

  // ── difficulty (weight 0.20) ───────────────────────────────────

  describe('difficulty factor', () => {
    it('returns 100 for minimum ease factor (1.3)', () => {
      const result = calculatePriorityScore(baseTask({ easeFactor: 1.3 }));
      expect(result.factors.difficulty).toBe(100);
    });

    it('returns 0 for ease factor 3.0', () => {
      const result = calculatePriorityScore(baseTask({ easeFactor: 3.0 }));
      expect(result.factors.difficulty).toBe(0);
    });

    it('returns 0 for ease factor above 3.0', () => {
      const result = calculatePriorityScore(baseTask({ easeFactor: 3.5 }));
      expect(result.factors.difficulty).toBe(0);
    });

    it('returns ~29 for default ease factor 2.5', () => {
      const result = calculatePriorityScore(baseTask({ easeFactor: 2.5 }));
      // (3.0 - 2.5) / 1.7 * 100 = 29.41...
      expect(result.factors.difficulty).toBeCloseTo(29.41, 0);
    });
  });

  // ── staleness (weight 0.15) ────────────────────────────────────

  describe('staleness factor', () => {
    it('returns 0 when last reviewed today', () => {
      const result = calculatePriorityScore(baseTask({ lastReviewed: daysFromNow(0) }));
      expect(result.factors.staleness).toBe(0);
    });

    it('scales at 3.3 per day since last activity', () => {
      const result = calculatePriorityScore(baseTask({ lastReviewed: daysFromNow(-10) }));
      expect(result.factors.staleness).toBeCloseTo(33, 0);
    });

    it('caps at 100 when very stale', () => {
      const result = calculatePriorityScore(baseTask({ lastReviewed: daysFromNow(-60) }));
      expect(result.factors.staleness).toBe(100);
    });

    it('falls back to createdAt when lastReviewed is null', () => {
      const result = calculatePriorityScore(
        baseTask({ lastReviewed: null, createdAt: daysFromNow(-10) }),
      );
      expect(result.factors.staleness).toBeCloseTo(33, 0);
    });
  });

  // ── aiWeakness (weight 0.10) ──────────────────────────────────

  describe('aiWeakness factor', () => {
    it('returns 0 when no AI data', () => {
      const result = calculatePriorityScore(baseTask(), null);
      expect(result.factors.aiWeakness).toBe(0);
    });

    it('returns 0 for perfect AI score (5.0)', () => {
      const result = calculatePriorityScore(baseTask(), { avgScore: 5.0 });
      expect(result.factors.aiWeakness).toBe(0);
    });

    it('returns 40 for AI score of 3.0', () => {
      const result = calculatePriorityScore(baseTask(), { avgScore: 3.0 });
      expect(result.factors.aiWeakness).toBe(40);
    });

    it('returns 100 for AI score of 0', () => {
      const result = calculatePriorityScore(baseTask(), { avgScore: 0 });
      expect(result.factors.aiWeakness).toBe(100);
    });
  });

  // ── composite score ────────────────────────────────────────────

  describe('composite score', () => {
    it('returns 0 for a fresh task with no urgency', () => {
      const result = calculatePriorityScore(baseTask());
      // Only non-zero factor is difficulty at ~29.41 * 0.20 = ~5.88
      // and staleness might be 0 if reviewed today
      expect(result.score).toBeLessThan(10);
    });

    it('returns high score for overdue + deadline today + hard + stale', () => {
      const result = calculatePriorityScore(
        baseTask({
          nextReview: daysFromNow(-7), // 100 overdue (capped)
          deadline: daysFromNow(0), // 100 deadline
          easeFactor: 1.3, // 100 difficulty
          lastReviewed: daysFromNow(-60), // 100 staleness
        }),
        { avgScore: 0 }, // 100 aiWeakness
      );
      expect(result.score).toBe(100);
    });

    it('correctly weights factors', () => {
      // Construct a scenario where only overdueUrgency is active
      const result = calculatePriorityScore(
        baseTask({
          nextReview: daysFromNow(-2), // 30 overdue
          easeFactor: 3.0, // 0 difficulty
          lastReviewed: daysFromNow(0), // 0 staleness
        }),
      );
      // overdue = 30 * 0.30 = 9, difficulty = 0, staleness = 0
      expect(result.score).toBe(9);
    });

    it('score is always between 0 and 100', () => {
      const low = calculatePriorityScore(baseTask());
      expect(low.score).toBeGreaterThanOrEqual(0);
      expect(low.score).toBeLessThanOrEqual(100);

      const high = calculatePriorityScore(
        baseTask({
          nextReview: daysFromNow(-100),
          deadline: daysFromNow(-5),
          easeFactor: 1.3,
          lastReviewed: daysFromNow(-200),
        }),
        { avgScore: 0 },
      );
      expect(high.score).toBeGreaterThanOrEqual(0);
      expect(high.score).toBeLessThanOrEqual(100);
    });
  });

  // ── edge cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles ai score omitted (undefined)', () => {
      const result = calculatePriorityScore(baseTask());
      expect(result.factors.aiWeakness).toBe(0);
    });

    it('returns all factor keys in result', () => {
      const result = calculatePriorityScore(baseTask());
      expect(result.factors).toHaveProperty('overdueUrgency');
      expect(result.factors).toHaveProperty('deadlinePressure');
      expect(result.factors).toHaveProperty('difficulty');
      expect(result.factors).toHaveProperty('staleness');
      expect(result.factors).toHaveProperty('aiWeakness');
    });

    it('score is a rounded integer', () => {
      const result = calculatePriorityScore(baseTask());
      expect(Number.isInteger(result.score)).toBe(true);
    });

    it('returns score 0 for invalid date input', () => {
      const result = calculatePriorityScore(
        baseTask({ nextReview: 'not-a-date', createdAt: '2025-01-01' }),
      );
      expect(result.score).toBe(0);
      expect(result.factors.overdueUrgency).toBe(0);
    });

    it('invalid deadline does not produce NaN', () => {
      const result = calculatePriorityScore(baseTask({ deadline: 'TBD' }));
      expect(Number.isNaN(result.score)).toBe(false);
      expect(result.factors.deadlinePressure).toBe(0);
    });

    it('invalid lastReviewed does not produce NaN', () => {
      const result = calculatePriorityScore(baseTask({ lastReviewed: 'soon' }));
      expect(Number.isNaN(result.score)).toBe(false);
      expect(result.factors.staleness).toBe(0);
    });
  });
});
