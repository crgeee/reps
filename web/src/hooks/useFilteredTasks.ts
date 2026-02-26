import { useMemo, useState, useCallback } from 'react';
import type { Task, Topic, TaskStatus } from '../types';

export type DueFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'no-deadline';
export type SortField = 'created' | 'next-review' | 'deadline' | 'ease-factor';
export type SortDir = 'asc' | 'desc';

export interface FilterState {
  topic: Topic | 'all';
  status: TaskStatus | 'all';
  due: DueFilter;
  search: string;
  sortField: SortField;
  sortDir: SortDir;
}

const DEFAULT_FILTERS: FilterState = {
  topic: 'all',
  status: 'all',
  due: 'all',
  search: '',
  sortField: 'created',
  sortDir: 'desc',
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0]!;
}

function endOfWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  return d.toISOString().split('T')[0]!;
}

function matchesDue(task: Task, due: DueFilter): boolean {
  const today = todayStr();
  switch (due) {
    case 'all': return true;
    case 'overdue': return task.nextReview < today && !task.completed;
    case 'today': return task.nextReview === today;
    case 'this-week': return task.nextReview >= today && task.nextReview <= endOfWeekStr();
    case 'no-deadline': return !task.deadline;
  }
}

function sortTasks(tasks: Task[], field: SortField, dir: SortDir): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'created': cmp = a.createdAt.localeCompare(b.createdAt); break;
      case 'next-review': cmp = a.nextReview.localeCompare(b.nextReview); break;
      case 'deadline': cmp = (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'); break;
      case 'ease-factor': cmp = a.easeFactor - b.easeFactor; break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function useFilteredTasks(tasks: Task[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const filtered = useMemo(() => {
    let result = tasks;

    if (filters.topic !== 'all') {
      result = result.filter((t) => t.topic === filters.topic);
    }
    if (filters.status !== 'all') {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters.due !== 'all') {
      result = result.filter((t) => matchesDue(t, filters.due));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    return sortTasks(result, filters.sortField, filters.sortDir);
  }, [tasks, filters]);

  return { filters, setFilter, resetFilters, filtered };
}
