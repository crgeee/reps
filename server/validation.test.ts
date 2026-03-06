import { describe, it, expect } from 'vitest';
import {
  validateUuid,
  buildUpdates,
  collectionSchema,
  tagSchema,
  templateSchema,
  priorityEnum,
  recurrenceDay,
} from './validation.js';

describe('validateUuid', () => {
  it('valid v4 UUID returns true', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('uppercase UUID returns true', () => {
    expect(validateUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('invalid string returns false', () => {
    expect(validateUuid('not-a-uuid')).toBe(false);
  });

  it('empty string returns false', () => {
    expect(validateUuid('')).toBe(false);
  });

  it('partial UUID returns false', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716')).toBe(false);
  });
});

describe('buildUpdates', () => {
  const fieldMap = {
    easeFactor: 'ease_factor',
    nextReview: 'next_review',
    lastReviewed: 'last_reviewed',
  };

  it('maps camelCase keys to snake_case via fieldMap', () => {
    const body = { easeFactor: 2.7, nextReview: '2025-06-15' };
    expect(buildUpdates(body, fieldMap)).toEqual({
      ease_factor: 2.7,
      next_review: '2025-06-15',
    });
  });

  it('ignores keys not present in body', () => {
    const body = { easeFactor: 2.7 };
    expect(buildUpdates(body, fieldMap)).toEqual({ ease_factor: 2.7 });
  });

  it('returns empty object for empty body', () => {
    expect(buildUpdates({}, fieldMap)).toEqual({});
  });

  it('includes null values when key is present in body', () => {
    const body = { lastReviewed: null };
    expect(buildUpdates(body as Record<string, unknown>, fieldMap)).toEqual({
      last_reviewed: null,
    });
  });

  it('includes undefined values when key is present in body', () => {
    const body = { lastReviewed: undefined };
    expect(buildUpdates(body as Record<string, unknown>, fieldMap)).toEqual({
      last_reviewed: undefined,
    });
  });

  it('ignores keys not in fieldMap', () => {
    const body = { easeFactor: 2.7, unknownField: 'should be ignored' };
    expect(buildUpdates(body, fieldMap)).toEqual({ ease_factor: 2.7 });
  });
});

describe('collectionSchema', () => {
  it('valid input succeeds', () => {
    const result = collectionSchema.safeParse({ name: 'My Collection' });
    expect(result.success).toBe(true);
  });

  it('missing name fails', () => {
    const result = collectionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('valid with all optional fields', () => {
    const result = collectionSchema.safeParse({
      name: 'Test',
      icon: '📚',
      color: '#ff0000',
      srEnabled: true,
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
  });
});

describe('tagSchema', () => {
  it('valid hex color passes', () => {
    const result = tagSchema.safeParse({ name: 'urgent', color: '#ff0000' });
    expect(result.success).toBe(true);
  });

  it('invalid color fails', () => {
    const result = tagSchema.safeParse({ name: 'urgent', color: 'red' });
    expect(result.success).toBe(false);
  });
});

describe('templateSchema', () => {
  const validTemplate = {
    name: 'Interview Prep',
    statuses: [{ name: 'todo' }, { name: 'done' }],
    tasks: [{ title: 'Study', statusName: 'todo' }],
  };

  it('valid template passes', () => {
    const result = templateSchema.safeParse(validTemplate);
    expect(result.success).toBe(true);
  });

  it('task with invalid statusName fails', () => {
    const result = templateSchema.safeParse({
      ...validTemplate,
      tasks: [{ title: 'Study', statusName: 'nonexistent' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('recurrenceDay', () => {
  it('valid day array passes', () => {
    expect(recurrenceDay.safeParse([0, 3, 6]).success).toBe(true);
  });

  it('single day passes', () => {
    expect(recurrenceDay.safeParse([1]).success).toBe(true);
  });

  it('all 7 days passes', () => {
    expect(recurrenceDay.safeParse([0, 1, 2, 3, 4, 5, 6]).success).toBe(true);
  });

  it('empty array fails (min 1)', () => {
    expect(recurrenceDay.safeParse([]).success).toBe(false);
  });

  it('more than 7 elements fails', () => {
    expect(recurrenceDay.safeParse([0, 1, 2, 3, 4, 5, 6, 0]).success).toBe(false);
  });

  it('day > 6 fails', () => {
    expect(recurrenceDay.safeParse([7]).success).toBe(false);
  });

  it('negative day fails', () => {
    expect(recurrenceDay.safeParse([-1]).success).toBe(false);
  });

  it('non-array fails', () => {
    expect(recurrenceDay.safeParse(3).success).toBe(false);
  });

  it('non-integer fails', () => {
    expect(recurrenceDay.safeParse([1.5]).success).toBe(false);
  });
});

describe('priorityEnum', () => {
  it('valid values pass', () => {
    for (const val of ['none', 'low', 'medium', 'high']) {
      expect(priorityEnum.safeParse(val).success).toBe(true);
    }
  });

  it('invalid value fails', () => {
    expect(priorityEnum.safeParse('critical').success).toBe(false);
  });
});
