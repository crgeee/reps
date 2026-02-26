import { useState, useMemo } from 'react';
import type { Task, Topic, Tag } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';
import TagBadge from './TagBadge';

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
  availableTags?: Tag[];
}

export default function TaskList({ tasks, onRefresh, availableTags = [] }: TaskListProps) {
  const { filters, setFilter, resetFilters, filtered } = useFilteredTasks(tasks);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const tagFiltered = useMemo(() => {
    if (!tagFilter) return filtered;
    return filtered.filter((t) => t.tags?.some((tag) => tag.id === tagFilter));
  }, [filtered, tagFilter]);

  const grouped = TOPICS.reduce<Record<Topic, Task[]>>((acc, topic) => {
    const topicTasks = tagFiltered.filter((t) => t.topic === topic);
    if (topicTasks.length > 0) acc[topic] = topicTasks;
    return acc;
  }, {} as Record<Topic, Task[]>);

  // Collect all unique tags used in tasks for the filter
  const usedTags = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    for (const task of tasks) {
      for (const tag of task.tags ?? []) {
        tagMap.set(tag.id, tag);
      }
    }
    // Merge with availableTags
    for (const tag of availableTags) {
      if (!tagMap.has(tag.id)) tagMap.set(tag.id, tag);
    }
    return Array.from(tagMap.values());
  }, [tasks, availableTags]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} />

      {/* Tag filter */}
      {usedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Tags</span>
          <button
            onClick={() => setTagFilter(null)}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              tagFilter === null
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            All
          </button>
          {usedTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
              className={`transition-all duration-150 ${tagFilter === tag.id ? 'ring-1 ring-zinc-400 rounded-full' : ''}`}
            >
              <TagBadge tag={tag} size="sm" />
            </button>
          ))}
        </div>
      )}

      {Object.entries(grouped).length === 0 && (
        <p className="text-zinc-500 py-12 text-center">No tasks found.</p>
      )}

      {Object.entries(grouped).map(([topic, topicTasks]) => (
        <div key={topic}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${TOPIC_COLORS[topic as Topic]}`} />
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {TOPIC_LABELS[topic as Topic]}
            </h2>
            <span className="text-xs text-zinc-600">{topicTasks.length}</span>
          </div>
          <div className="space-y-2">
            {topicTasks.map((task) => (
              <TaskCard key={task.id} task={task} onRefresh={onRefresh} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
