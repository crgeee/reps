import { useMemo, useState, useCallback } from 'react';
import type { Task, Topic } from '../types';

export type DueFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'no-deadline';
export type SortField = 'created' | 'next-review' | 'deadline' | 'ease-factor';
export type SortDir = 'asc' | 'desc';
export type GroupBy = 'none' | 'status' | 'topic';

export interface FilterState {
  topic: Topic | 'all';
  status: string | 'all';
  due: DueFilter;
  search: string;
  sortField: SortField;
  sortDir: SortDir;
  hideCompleted: boolean;
  groupBy: GroupBy;
}

function getInitialFilters(): FilterState {
  return {
    topic: 'all',
    status: 'all',
    due: 'all',
    search: '',
    sortField: 'created',
    sortDir: 'desc',
    hideCompleted: localStorage.getItem('reps_hide_completed') !== 'false',
    groupBy: (localStorage.getItem('reps_group_by') as GroupBy) || 'none',
  };
}

const DEFAULT_FILTERS: FilterState = {
  topic: 'all',
  status: 'all',
  due: 'all',
  search: '',
  sortField: 'created',
  sortDir: 'desc',
  hideCompleted: true,
  groupBy: 'none',
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
  const [filters, setFilters] = useState<FilterState>(getInitialFilters);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === 'hideCompleted') {
      localStorage.setItem('reps_hide_completed', String(value));
    }
    if (key === 'groupBy') {
      localStorage.setItem('reps_group_by', String(value));
    }
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const filtered = useMemo(() => {
    let result = tasks;

    if (filters.hideCompleted) {
      result = result.filter((t) => !t.completed);
    }
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

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (filters.groupBy === 'none') return map;

    for (const task of filtered) {
      const key = filters.groupBy === 'status' ? task.status : task.topic;
      const arr = map.get(key) ?? [];
      arr.push(task);
      map.set(key, arr);
    }
    return map;
  }, [filtered, filters.groupBy]);

  return { filters, setFilter, resetFilters, filtered, grouped };
}
