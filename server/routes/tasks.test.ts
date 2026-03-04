import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: {} }));

import { toDateStr, rowToNote, groupNotes } from './tasks.js';
import type { NoteRow } from './tasks.js';

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

  it('does not include task_id in output', () => {
    const row: NoteRow = {
      id: 'abc-123',
      task_id: 'task-1',
      text: 'test',
      created_at: '2025-01-01',
    };
    const note = rowToNote(row);
    expect(note).not.toHaveProperty('task_id');
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
