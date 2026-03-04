import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: {} }));

import { toDateStr, rowToNote, groupNotes, rowToTask, syncStatusCompleted } from './tasks.js';
import type { NoteRow, TaskRow } from './tasks.js';

describe('toDateStr', () => {
  it('null returns undefined', () => {
    expect(toDateStr(null)).toBeUndefined();
  });

  it('undefined returns undefined', () => {
    expect(toDateStr(undefined)).toBeUndefined();
  });

  it('Date object returns yyyy-MM-dd', () => {
    expect(toDateStr(new Date('2025-06-15T12:00:00Z'))).toBe('2025-06-15');
  });

  it('ISO string returns yyyy-MM-dd', () => {
    expect(toDateStr('2025-06-15T12:00:00Z')).toBe('2025-06-15');
  });

  it('date-only string returns as-is', () => {
    expect(toDateStr('2025-06-15')).toBe('2025-06-15');
  });

  it('Date near midnight UTC does not shift day', () => {
    expect(toDateStr(new Date('2025-06-15T23:59:59Z'))).toBe('2025-06-15');
  });
});

describe('rowToNote', () => {
  it('maps NoteRow to Note with date truncation', () => {
    const row: NoteRow = {
      id: 'abc-123',
      task_id: 'task-1',
      text: 'some note',
      created_at: '2025-06-15T12:00:00Z',
    };
    const note = rowToNote(row);
    expect(note).toEqual({
      id: 'abc-123',
      text: 'some note',
      createdAt: '2025-06-15',
    });
  });
});

describe('groupNotes', () => {
  it('groups notes by task_id', () => {
    const rows: NoteRow[] = [
      { id: 'n1', task_id: 't1', text: 'a', created_at: '2025-01-01' },
      { id: 'n2', task_id: 't2', text: 'b', created_at: '2025-01-02' },
      { id: 'n3', task_id: 't1', text: 'c', created_at: '2025-01-03' },
    ];
    const grouped = groupNotes(rows);
    expect(grouped.size).toBe(2);
    expect(grouped.get('t1')).toHaveLength(2);
    expect(grouped.get('t2')).toHaveLength(1);
  });

  it('preserves order within each group', () => {
    const rows: NoteRow[] = [
      { id: 'n1', task_id: 't1', text: 'first', created_at: '2025-01-01' },
      { id: 'n2', task_id: 't1', text: 'second', created_at: '2025-01-02' },
    ];
    const grouped = groupNotes(rows);
    const notes = grouped.get('t1')!;
    expect(notes[0].text).toBe('first');
    expect(notes[1].text).toBe('second');
  });

  it('returns empty map for empty input', () => {
    const grouped = groupNotes([]);
    expect(grouped.size).toBe(0);
  });
});

function makeTaskRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    topic: 'coding',
    title: 'Test task',
    completed: false,
    status: 'todo',
    deadline: null,
    repetitions: 0,
    interval: 1,
    ease_factor: 2.5,
    next_review: '2025-06-15',
    last_reviewed: null,
    created_at: '2025-01-01',
    collection_id: null,
    description: null,
    priority: 'none',
    ...overrides,
  };
}

describe('rowToTask', () => {
  it('maps snake_case DB row to camelCase API shape', () => {
    const row = makeTaskRow({
      ease_factor: 2.7,
      next_review: '2025-06-15',
      last_reviewed: '2025-06-10',
      created_at: '2025-01-01',
      collection_id: 'col-1',
    });
    const result = rowToTask(row, []);
    expect(result.easeFactor).toBe(2.7);
    expect(result.nextReview).toBe('2025-06-15');
    expect(result.lastReviewed).toBe('2025-06-10');
    expect(result.createdAt).toBe('2025-01-01');
    expect(result.collectionId).toBe('col-1');
  });

  it('handles null optional fields', () => {
    const row = makeTaskRow({ deadline: null, last_reviewed: null, description: null });
    const result = rowToTask(row, []);
    expect(result.deadline).toBeUndefined();
    expect(result.lastReviewed).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it('attaches notes and tags', () => {
    const notes = [{ id: 'n1', text: 'note', createdAt: '2025-01-01' }];
    const tags = [{ id: 't1', name: 'urgent', color: '#ff0000' }];
    const result = rowToTask(makeTaskRow(), notes, tags);
    expect(result.notes).toEqual(notes);
    expect(result.tags).toEqual(tags);
  });

  it('defaults tags to empty array', () => {
    const result = rowToTask(makeTaskRow(), []);
    expect(result.tags).toEqual([]);
  });
});

describe('syncStatusCompleted', () => {
  it('setting status=done auto-sets completed=true', () => {
    const updates: Record<string, unknown> = { status: 'done' };
    syncStatusCompleted(updates);
    expect(updates.completed).toBe(true);
  });

  it('setting status=todo auto-sets completed=false', () => {
    const updates: Record<string, unknown> = { status: 'todo' };
    syncStatusCompleted(updates);
    expect(updates.completed).toBe(false);
  });

  it('setting completed=true auto-sets status=done', () => {
    const updates: Record<string, unknown> = { completed: true };
    syncStatusCompleted(updates);
    expect(updates.status).toBe('done');
  });

  it('setting completed=false auto-sets status=todo', () => {
    const updates: Record<string, unknown> = { completed: false };
    syncStatusCompleted(updates);
    expect(updates.status).toBe('todo');
  });

  it('setting both does not override either', () => {
    const updates: Record<string, unknown> = { status: 'in-progress', completed: false };
    syncStatusCompleted(updates);
    expect(updates.status).toBe('in-progress');
    expect(updates.completed).toBe(false);
  });

  it('empty updates remains empty', () => {
    const updates: Record<string, unknown> = {};
    syncStatusCompleted(updates);
    expect(Object.keys(updates)).toHaveLength(0);
  });
});
