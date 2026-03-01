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
