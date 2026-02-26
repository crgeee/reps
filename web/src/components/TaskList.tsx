import { useState, useMemo } from 'react';
import type { Task, Topic, Tag, Collection } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS, STATUS_LABELS } from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';
import TagBadge from './TagBadge';
import TaskEditModal from './TaskEditModal';

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
  availableTags?: Tag[];
  collections?: Collection[];
  onTagCreated?: (tag: Tag) => void;
  statusOptions?: { value: string; label: string }[];
}

export default function TaskList({ tasks, onRefresh, availableTags = [], collections = [], onTagCreated, statusOptions }: TaskListProps) {
  const { filters, setFilter, resetFilters, filtered, grouped } = useFilteredTasks(tasks);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const tagFiltered = useMemo(() => {
    if (!tagFilter) return filtered;
    return filtered.filter((t) => t.tags?.some((tag) => tag.id === tagFilter));
  }, [filtered, tagFilter]);

  const topicGroups = TOPICS.reduce<Record<Topic, Task[]>>((acc, topic) => {
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

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} statusOptions={statusOptions} />

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

      {filters.groupBy !== 'none' ? (
        <>
          {grouped.size === 0 && tagFiltered.length === 0 && (
            <p className="text-zinc-500 py-12 text-center">No tasks found.</p>
          )}
          {Array.from(grouped.entries()).map(([groupKey, groupTasks]) => {
            const filteredGroup = tagFilter
              ? groupTasks.filter((t) => t.tags?.some((tag) => tag.id === tagFilter))
              : groupTasks;
            if (filteredGroup.length === 0) return null;

            const label = filters.groupBy === 'topic'
              ? (TOPIC_LABELS[groupKey as Topic] ?? groupKey)
              : (STATUS_LABELS[groupKey as keyof typeof STATUS_LABELS] ?? groupKey.charAt(0).toUpperCase() + groupKey.slice(1));
            const isDone = groupKey === 'done';

            return (
              <GroupSection
                key={groupKey}
                label={label}
                count={filteredGroup.length}
                defaultCollapsed={isDone}
              >
                {filteredGroup.map((task) => (
                  <TaskCard key={task.id} task={task} onRefresh={onRefresh} onEdit={setEditingTask} />
                ))}
              </GroupSection>
            );
          })}
        </>
      ) : (
        <>
          {Object.entries(topicGroups).length === 0 && (
            <p className="text-zinc-500 py-12 text-center">No tasks found.</p>
          )}
          {Object.entries(topicGroups).map(([topic, topicTasks]) => (
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
                  <TaskCard key={task.id} task={task} onRefresh={onRefresh} onEdit={setEditingTask} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          collections={collections}
          availableTags={availableTags}
          onSaved={() => { onRefresh(); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
          onTagCreated={onTagCreated}
        />
      )}
    </div>
  );
}

function GroupSection({
  label,
  count,
  defaultCollapsed = false,
  children,
}: {
  label: string;
  count: number;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-3 group"
      >
        <svg
          className={`w-3 h-3 text-zinc-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          {label}
        </h2>
        <span className="text-xs text-zinc-600">{count}</span>
      </button>
      {!collapsed && (
        <div className="space-y-2 ml-5">
          {children}
        </div>
      )}
    </div>
  );
}
