import { memo, useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus, Collection, Tag, CollectionStatus } from '../types';
import { STATUSES, STATUS_LABELS } from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';
import TaskEditModal from './TaskEditModal';
import { updateTask } from '../api';
import { logger } from '../logger';

interface BoardViewProps {
  tasks: Task[];
  onRefresh: () => void;
  onOptimisticUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onBackgroundRefresh?: () => void;
  collections?: Collection[];
  availableTags?: Tag[];
  onTagCreated?: (tag: Tag) => void;
  collectionStatuses?: CollectionStatus[];
  statusOptions?: { value: string; label: string }[];
}

const DEFAULT_STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': '#3f3f46',
  'in-progress': '#1e3a5f',
  'review': '#78350f',
  'done': '#14532d',
};

const SortableCard = memo(function SortableCard({ task, onRefresh, onEdit }: { task: Task; onRefresh: () => void; onEdit?: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'card', status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
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

export default function BoardView({ tasks, onRefresh, onOptimisticUpdate, onBackgroundRefresh, collections = [], availableTags = [], onTagCreated, collectionStatuses, statusOptions }: BoardViewProps) {
  const { filters, setFilter, resetFilters, filtered } = useFilteredTasks(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Derive status list from collection statuses or fall back to defaults
  const statusList = useMemo(() => {
    if (collectionStatuses && collectionStatuses.length > 0) {
      return collectionStatuses.map(s => s.name);
    }
    return STATUSES as string[];
  }, [collectionStatuses]);

  const statusLabels = useMemo(() => {
    if (collectionStatuses && collectionStatuses.length > 0) {
      const map: Record<string, string> = {};
      for (const s of collectionStatuses) {
        map[s.name] = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      }
      return map;
    }
    return STATUS_LABELS as Record<string, string>;
  }, [collectionStatuses]);

  const statusColors = useMemo(() => {
    if (collectionStatuses && collectionStatuses.length > 0) {
      const map: Record<string, string> = {};
      for (const s of collectionStatuses) {
        map[s.name] = s.color ?? '#3f3f46';
      }
      return map;
    }
    return DEFAULT_STATUS_COLORS as Record<string, string>;
  }, [collectionStatuses]);

  const columns = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of statusList) {
      map[s] = filtered.filter((t) => t.status === s);
    }
    return map;
  }, [filtered, statusList]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const findColumnForOver = useCallback((overId: string | number, overData: Record<string, unknown> | undefined): string | null => {
    const id = String(overId);
    if (overData?.type === 'column' && statusList.includes(id)) {
      return id;
    }
    if (overData?.type === 'card' && overData.status) {
      return overData.status as string;
    }
    return null;
  }, [statusList]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const targetStatus = findColumnForOver(over.id, over.data.current);
    if (!targetStatus || targetStatus === task.status) return;

    // Optimistic: move card in local state immediately (no loading spinner)
    if (onOptimisticUpdate) {
      onOptimisticUpdate(taskId, {
        status: targetStatus,
        completed: targetStatus === 'done',
      });
    }

    // Sync with server in background
    try {
      await updateTask(taskId, { status: targetStatus });
      // Quietly refresh to pick up any server-side changes
      if (onBackgroundRefresh) onBackgroundRefresh();
    } catch (err) {
      logger.error('Failed to update task status', { taskId, targetStatus, error: String(err) });
      // Revert: full refresh to get correct state
      onRefresh();
    }
  }, [tasks, onRefresh, onOptimisticUpdate, onBackgroundRefresh, findColumnForOver]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Compute grid columns class based on number of statuses
  const gridColsClass = useMemo(() => {
    const count = statusList.length;
    if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    if (count === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    if (count === 5) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6';
  }, [statusList.length]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Board</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} hideStatus statusOptions={statusOptions} />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={`grid ${gridColsClass} gap-4 min-h-[60vh]`}>
          {statusList.map((status) => (
            <Column
              key={status}
              status={status}
              label={statusLabels[status] ?? status}
              tasks={columns[status] ?? []}
              onRefresh={onRefresh}
              borderColor={statusColors[status]}
              onEdit={setEditingTask}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask && <TaskCard task={activeTask} onRefresh={() => {}} compact />}
        </DragOverlay>
      </DndContext>

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

const Column = memo(function Column({
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
      className={`border-t-2 rounded-lg p-3 space-y-2 transition-colors ${
        isOver ? 'bg-zinc-800/50' : 'bg-zinc-900/30'
      }`}
      style={{ borderTopColor: borderColor ?? '#3f3f46' }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-400">{label}</h3>
        <span className="text-xs text-zinc-600">{tasks.length}</span>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableCard key={task.id} task={task} onRefresh={onRefresh} onEdit={onEdit} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <p className={`text-xs text-center py-8 ${isOver ? 'text-zinc-500' : 'text-zinc-700'}`}>
          Drop here
        </p>
      )}
    </div>
  );
});
