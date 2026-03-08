import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: vi.fn() }));

import { toTrack, toModule, toProgress } from './learn.js';

describe('toTrack', () => {
  it('converts DB row to Track', () => {
    const row = {
      id: '123',
      slug: 'flask',
      title: 'Flask',
      description: 'Learn Flask',
      image_url: null,
      created_at: '2026-01-01',
      module_count: '10',
    };
    const result = toTrack(row);
    expect(result).toEqual({
      id: '123',
      slug: 'flask',
      title: 'Flask',
      description: 'Learn Flask',
      imageUrl: null,
      createdAt: '2026-01-01',
      moduleCount: 10,
    });
  });
});

describe('toModule', () => {
  it('converts DB row to Module', () => {
    const row = {
      id: '456',
      track_id: '123',
      slug: 'routing',
      title: 'Routing',
      description: 'URL rules',
      sort_order: 2,
      prerequisites: [],
      concepts: ['routes', 'url_for'],
      created_at: '2026-01-01',
    };
    const result = toModule(row);
    expect(result).toEqual({
      id: '456',
      trackId: '123',
      slug: 'routing',
      title: 'Routing',
      description: 'URL rules',
      sortOrder: 2,
      prerequisites: [],
      concepts: ['routes', 'url_for'],
      createdAt: '2026-01-01',
    });
  });
});

describe('toProgress', () => {
  it('converts DB row to UserProgress', () => {
    const row = {
      id: '789',
      user_id: 'u1',
      module_id: '456',
      status: 'active',
      repetitions: 2,
      interval: 6,
      ease_factor: 2.5,
      next_review: '2026-01-07',
      last_reviewed: '2026-01-01',
      created_at: '2026-01-01',
    };
    const result = toProgress(row);
    expect(result).toEqual({
      id: '789',
      userId: 'u1',
      moduleId: '456',
      status: 'active',
      repetitions: 2,
      interval: 6,
      easeFactor: 2.5,
      nextReview: '2026-01-07',
      lastReviewed: '2026-01-01',
      createdAt: '2026-01-01',
    });
  });
});
