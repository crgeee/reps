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
import type { Task, TaskStatus } from '../types';
import { STATUSES, STATUS_LABELS } from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';
import { updateTask } from '../api';
import { logger } from '../logger';

interface BoardViewProps {
  tasks: Task[];
  onRefresh: () => void;
  onOptimisticUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onBackgroundRefresh?: () => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': 'border-zinc-700',
  'in-progress': 'border-blue-800',
  'review': 'border-amber-800',
  'done': 'border-green-800',
};

const SortableCard = memo(function SortableCard({ task, onRefresh }: { task: Task; onRefresh: () => void }) {
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
      />
    </div>
  );
});

function findColumnForOver(overId: string | number, overData: Record<string, unknown> | undefined): TaskStatus | null {
  if (overData?.type === 'column' && STATUSES.includes(overId as TaskStatus)) {
    return overId as TaskStatus;
  }
  if (overData?.type === 'card' && overData.status) {
    return overData.status as TaskStatus;
  }
  return null;
}

export default function BoardView({ tasks, onRefresh, onOptimisticUpdate, onBackgroundRefresh }: BoardViewProps) {
  const { filters, setFilter, resetFilters, filtered } = useFilteredTasks(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const columns = useMemo(() =>
    STATUSES.reduce<Record<TaskStatus, Task[]>>((acc, status) => {
      acc[status] = filtered.filter((t) => t.status === status);
      return acc;
    }, {} as Record<TaskStatus, Task[]>),
    [filtered],
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

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
      onOptimisticUpdate(taskId, { status: targetStatus });
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
  }, [tasks, onRefresh, onOptimisticUpdate, onBackgroundRefresh]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Board</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} hideStatus />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-4 gap-4 min-h-[60vh]">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columns[status]}
              onRefresh={onRefresh}
              color={STATUS_COLORS[status]}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask && <TaskCard task={activeTask} onRefresh={() => {}} compact />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

const Column = memo(function Column({
  status,
  tasks,
  onRefresh,
  color,
}: {
  status: TaskStatus;
  tasks: Task[];
  onRefresh: () => void;
  color: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'column' },
  });

  const itemIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={`border-t-2 ${color} rounded-lg p-3 space-y-2 transition-colors ${
        isOver ? 'bg-zinc-800/50' : 'bg-zinc-900/30'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-400">{STATUS_LABELS[status]}</h3>
        <span className="text-xs text-zinc-600">{tasks.length}</span>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableCard key={task.id} task={task} onRefresh={onRefresh} />
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
