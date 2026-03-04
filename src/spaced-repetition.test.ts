import { describe, it, expect } from 'vitest';
import { calculateSM2 } from './spaced-repetition.js';
import type { Task, Quality } from './types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    topic: 'coding',
    title: 'Test task',
    notes: [],
    completed: false,
    status: 'todo',
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReview: '2025-01-01',
    createdAt: '2025-01-01',
    ...overrides,
  };
}

describe('calculateSM2', () => {
  it('first review with quality >= 3: interval=1, repetitions=1', () => {
    const result = calculateSM2(makeTask({ repetitions: 0 }), 4);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
  });

  it('second review with quality >= 3: interval=6, repetitions=2', () => {
    const result = calculateSM2(makeTask({ repetitions: 1, interval: 1 }), 4);
    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  it('third+ review: interval = round(prev_interval * easeFactor)', () => {
    const task = makeTask({ repetitions: 2, interval: 6, easeFactor: 2.5 });
    const result = calculateSM2(task, 4);
    expect(result.repetitions).toBe(3);
    expect(result.interval).toBe(15); // round(6 * 2.5)
  });

  it('quality < 3 resets repetitions and interval', () => {
    const task = makeTask({ repetitions: 5, interval: 30, easeFactor: 2.5 });
    const result = calculateSM2(task, 2);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  it('ease factor never drops below 1.3', () => {
    const task = makeTask({ easeFactor: 1.3 });
    const result = calculateSM2(task, 0);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('ease factor increases with quality=5', () => {
    const task = makeTask({ easeFactor: 2.5 });
    const result = calculateSM2(task, 5);
    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  it('quality=3 boundary case', () => {
    const result = calculateSM2(makeTask({ repetitions: 0 }), 3);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    // EF decreases slightly with quality=3
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it('quality=0 worst case', () => {
    const task = makeTask({ repetitions: 3, interval: 15, easeFactor: 2.5 });
    const result = calculateSM2(task, 0);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    // EF formula: 2.5 + (0.1 - 5*(0.08 + 5*0.02)) = 2.5 + (0.1 - 0.9) = 1.7
    expect(result.easeFactor).toBe(1.7);
  });

  it('nextReview is today + interval days', () => {
    const result = calculateSM2(makeTask({ repetitions: 0 }), 4);
    const expected = new Date();
    expected.setDate(expected.getDate() + result.interval);
    expect(result.nextReview).toBe(expected.toISOString().split('T')[0]);
  });

  it('all quality values 0-5 produce valid results', () => {
    for (let q = 0; q <= 5; q++) {
      const result = calculateSM2(makeTask(), q as Quality);
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
      expect(result.interval).toBeGreaterThanOrEqual(1);
      expect(result.repetitions).toBeGreaterThanOrEqual(0);
      expect(result.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
