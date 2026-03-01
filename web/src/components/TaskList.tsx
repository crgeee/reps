import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Topic, TaskStatus, Tag, Collection, CollectionStatus } from '../types';
import {
  TOPICS,
  STATUSES,
  STATUS_LABELS,
  formatStatusLabel,
  getTopicLabel,
  getTopicColor,
} from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';
import TagBadge from './TagBadge';
import TaskEditModal from './TaskEditModal';
import { updateTask } from '../api';
import { logger } from '../logger';

type LayoutMode = 'list' | 'board';

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
  availableTags?: Tag[];
  collections?: Collection[];
  onTagCreated?: (tag: Tag) => void;
  statusOptions?: { value: string; label: string }[];
  onOptimisticUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onBackgroundRefresh?: () => void;
  collectionStatuses?: CollectionStatus[];
  initialTopicFilter?: string | null;
}

const DEFAULT_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#3f3f46',
  'in-progress': '#1e3a5f',
  review: '#78350f',
  done: '#14532d',
};

export default function TaskList({
  tasks,
  onRefresh,
  availableTags = [],
  collections = [],
  onTagCreated,
  statusOptions,
  onOptimisticUpdate,
  onBackgroundRefresh,
  collectionStatuses,
  initialTopicFilter,
}: TaskListProps) {
  const { filters, setFilter, resetFilters, filtered, grouped } = useFilteredTasks(tasks);
  const [appliedInitialFilter, setAppliedInitialFilter] = useState<string | null>(null);

  useEffect(() => {
    if (initialTopicFilter && initialTopicFilter !== appliedInitialFilter) {
      setFilter('topic', initialTopicFilter as Topic | 'all');
      setAppliedInitialFilter(initialTopicFilter);
    }
  }, [initialTopicFilter, appliedInitialFilter, setFilter]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [layout, setLayout] = useState<LayoutMode>(() => {
    return (localStorage.getItem('reps_task_layout') as LayoutMode) || 'list';
  });

  function handleLayoutChange(mode: LayoutMode) {
    setLayout(mode);
    localStorage.setItem('reps_task_layout', mode);
  }

  const srByCollection = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const c of collections) map.set(c.id, c.srEnabled);
    return map;
  }, [collections]);

  const tagFiltered = useMemo(() => {
    if (!tagFilter) return filtered;
    return filtered.filter((t) => t.tags?.some((tag) => tag.id === tagFilter));
  }, [filtered, tagFilter]);

  const topicGroups = TOPICS.reduce<Record<Topic, Task[]>>(
    (acc, topic) => {
      const topicTasks = tagFiltered.filter((t) => t.topic === topic);
      if (topicTasks.length > 0) acc[topic] = topicTasks;
      return acc;
    },
    {} as Record<Topic, Task[]>,
  );

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
            {tagFiltered.length} items
          </span>
          <LayoutToggle layout={layout} onChange={handleLayoutChange} />
        </div>
      </div>

      <FilterBar
        filters={filters}
        setFilter={setFilter}
        resetFilters={resetFilters}
        hideStatus={layout === 'board'}
        statusOptions={statusOptions}
      />

      {/* Tag filter */}
      {usedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
            Tags
          </span>
          <button
            onClick={() => setTagFilter(null)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
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

      {layout === 'board' ? (
        <BoardLayout
          tasks={tasks}
          filtered={tagFiltered}
          onRefresh={onRefresh}
          onEdit={setEditingTask}
          onOptimisticUpdate={onOptimisticUpdate}
          onBackgroundRefresh={onBackgroundRefresh}
          collectionStatuses={collectionStatuses}
        />
      ) : filters.groupBy !== 'none' ? (
        <>
          {grouped.size === 0 && tagFiltered.length === 0 && (
            <p className="text-zinc-500 py-8 text-center text-xs">No tasks found.</p>
          )}
          {Array.from(grouped.entries()).map(([groupKey, groupTasks]) => {
            const filteredGroup = tagFilter
              ? groupTasks.filter((t) => t.tags?.some((tag) => tag.id === tagFilter))
              : groupTasks;
            if (filteredGroup.length === 0) return null;

            const label =
              filters.groupBy === 'topic'
                ? getTopicLabel(groupKey)
                : (STATUS_LABELS[groupKey as keyof typeof STATUS_LABELS] ??
                  formatStatusLabel(groupKey));
            const isDone = groupKey === 'done';

            return (
              <GroupSection
                key={groupKey}
                label={label}
                count={filteredGroup.length}
                defaultCollapsed={isDone}
              >
                <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/40">
                  {filteredGroup.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onRefresh={onRefresh}
                      onEdit={setEditingTask}
                      srEnabled={srByCollection.get(task.collectionId ?? '') ?? false}
                    />
                  ))}
                </div>
              </GroupSection>
            );
          })}
        </>
      ) : (
        <>
          {Object.entries(topicGroups).length === 0 && (
            <p className="text-zinc-500 py-8 text-center text-xs">No tasks found.</p>
          )}
          {Object.entries(topicGroups).map(([topic, topicTasks]) => (
            <div key={topic}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${getTopicColor(topic)}`} />
                <h2 className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  {getTopicLabel(topic)}
                </h2>
                <span className="text-[10px] text-zinc-500 font-mono">{topicTasks.length}</span>
              </div>
              <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/40">
                {topicTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onRefresh={onRefresh}
                    onEdit={setEditingTask}
                    srEnabled={srByCollection.get(task.collectionId ?? '') ?? false}
                  />
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
          onSaved={() => {
            onRefresh();
            setEditingTask(null);
          }}
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
        aria-expanded={!collapsed}
        className="flex items-center gap-2 mb-1.5 group"
      >
        <svg
          className={`w-2.5 h-2.5 text-zinc-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{label}</h2>
        <span className="text-[10px] text-zinc-500 font-mono">{count}</span>
      </button>
      {!collapsed && <div className="anim-expand-down ml-4">{children}</div>}
    </div>
  );
}

/* ── Layout Toggle ── */

function LayoutToggle({
  layout,
  onChange,
}: {
  layout: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}) {
  return (
    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
      <button
        onClick={() => onChange('list')}
        aria-label="List view"
        aria-pressed={layout === 'list'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          layout === 'list' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="hidden sm:inline">List</span>
      </button>
      <button
        onClick={() => onChange('board')}
        aria-label="Board view"
        aria-pressed={layout === 'board'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          layout === 'board' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4a1 1 0 001-1V5a1 1 0 00-1-1zM19 4h-4a1 1 0 00-1 1v14a1 1 0 001 1h4a1 1 0 001-1V5a1 1 0 00-1-1z"
          />
        </svg>
        <span className="hidden sm:inline">Board</span>
      </button>
    </div>
  );
}

/* ── Board Layout (integrated from BoardView) ── */

const SortableCard = memo(function SortableCard({
  task,
  onRefresh,
  onEdit,
}: {
  task: Task;
  onRefresh: () => void;
  onEdit?: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'card', status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'shadow-lg shadow-black/40 rounded' : ''}
    >
      <TaskCard
        task={task}
        onRefresh={onRefresh}
        compact
        dragHandleProps={{ ...attributes, ...listeners }}
        onEdit={onEdit}
      />
    </div>
  );
});

const BoardColumn = memo(function BoardColumn({
  status,
  label,
  tasks,
  onRefresh,
  borderColor,
  onEdit,
}: {
  status: string;
  label: string;
  tasks: Task[];
  onRefresh: () => void;
  borderColor?: string;
  onEdit?: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'column' },
  });

  const itemIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={`border-t-2 rounded-lg p-2 space-y-0 transition-colors ${
        isOver ? 'bg-zinc-800/50' : 'bg-zinc-900/30'
      }`}
      style={{ borderTopColor: borderColor ?? '#3f3f46' }}
    >
      <div className="flex items-center justify-between mb-1.5 px-1">
        <h3 className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{label}</h3>
        <span className="text-[10px] text-zinc-500 font-mono tabular-nums">{tasks.length}</span>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableCard key={task.id} task={task} onRefresh={onRefresh} onEdit={onEdit} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <p className={`text-xs text-center py-8 ${isOver ? 'text-zinc-400' : 'text-zinc-600'}`}>
          Drop here
        </p>
      )}
    </div>
  );
});

function BoardLayout({
  tasks,
  filtered,
  onRefresh,
  onEdit,
  onOptimisticUpdate,
  onBackgroundRefresh,
  collectionStatuses,
}: {
  tasks: Task[];
  filtered: Task[];
  onRefresh: () => void;
  onEdit: (task: Task) => void;
  onOptimisticUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onBackgroundRefresh?: () => void;
  collectionStatuses?: CollectionStatus[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { statusList, statusLabels, statusColors } = useMemo(() => {
    if (collectionStatuses && collectionStatuses.length > 0) {
      const list: string[] = [];
      const labels: Record<string, string> = {};
      const colors: Record<string, string> = {};
      for (const s of collectionStatuses) {
        list.push(s.name);
        labels[s.name] = formatStatusLabel(s.name);
        colors[s.name] = s.color ?? '#3f3f46';
      }
      return { statusList: list, statusLabels: labels, statusColors: colors };
    }
    return {
      statusList: STATUSES as string[],
      statusLabels: STATUS_LABELS as Record<string, string>,
      statusColors: DEFAULT_STATUS_COLORS as Record<string, string>,
    };
  }, [collectionStatuses]);

  const columns = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of statusList) {
      map[s] = filtered.filter((t) => t.status === s);
    }
    return map;
  }, [filtered, statusList]);

  const findColumnForOver = useCallback(
    (overId: string | number, overData: Record<string, unknown> | undefined): string | null => {
      const id = String(overId);
      if (overData?.type === 'column' && statusList.includes(id)) return id;
      if (overData?.type === 'card' && overData.status) return overData.status as string;
      return null;
    },
    [statusList],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const targetStatus = findColumnForOver(over.id, over.data.current);
      if (!targetStatus || targetStatus === task.status) return;

      if (onOptimisticUpdate) {
        onOptimisticUpdate(taskId, { status: targetStatus, completed: targetStatus === 'done' });
      }

      try {
        await updateTask(taskId, { status: targetStatus });
        if (onBackgroundRefresh) onBackgroundRefresh();
      } catch (err) {
        logger.error('Failed to update task status', { taskId, targetStatus, error: String(err) });
        onRefresh();
      }
    },
    [tasks, onRefresh, onOptimisticUpdate, onBackgroundRefresh, findColumnForOver],
  );

  const gridColsClass = useMemo(() => {
    const count = statusList.length;
    if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    if (count === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    if (count === 5) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6';
  }, [statusList.length]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className={`grid ${gridColsClass} gap-4 min-h-[60vh]`}>
        {statusList.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            label={statusLabels[status] ?? status}
            tasks={columns[status] ?? []}
            onRefresh={onRefresh}
            borderColor={statusColors[status]}
            onEdit={onEdit}
          />
        ))}
      </div>
    </DndContext>
  );
}
