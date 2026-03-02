import { useMemo } from 'react';
import type { Task } from '../types';

/** Derives the unique set of topic strings from actual task data. */
export function useTaskTopics(tasks: Task[]): string[] {
  return useMemo(() => {
    const seen = new Set<string>();
    for (const t of tasks) {
      seen.add(t.topic);
    }
    return Array.from(seen).sort();
  }, [tasks]);
}

/** Groups tasks by topic, returning a Map of topic → Task[]. */
export function useGroupedTasksByTopic(tasks: Task[]): Map<string, Task[]> {
  return useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const list = map.get(t.topic) ?? [];
      list.push(t);
      map.set(t.topic, list);
    }
    return map;
  }, [tasks]);
}
