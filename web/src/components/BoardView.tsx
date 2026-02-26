import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
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

interface BoardViewProps {
  tasks: Task[];
  onRefresh: () => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': 'border-zinc-700',
  'in-progress': 'border-blue-800',
  'review': 'border-amber-800',
  'done': 'border-green-800',
};

function SortableCard({ task, onRefresh }: { task: Task; onRefresh: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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
}

export default function BoardView({ tasks, onRefresh }: BoardViewProps) {
  const { filters, setFilter, resetFilters, filtered } = useFilteredTasks(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns = STATUSES.reduce<Record<TaskStatus, Task[]>>((acc, status) => {
    acc[status] = filtered.filter((t) => t.status === status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

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

    // Determine target status: either dropped on a column or on a card in a column
    let targetStatus: TaskStatus | undefined;

    if (STATUSES.includes(over.id as TaskStatus)) {
      targetStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (!targetStatus || targetStatus === task.status) return;

    // Optimistic update + API call
    try {
      await updateTask(taskId, { status: targetStatus });
      onRefresh();
    } catch {
      onRefresh(); // revert on failure
    }
  }, [tasks, onRefresh]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Board</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} hideStatus />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
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

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onRefresh={() => {}} compact />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
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
  const { setNodeRef } = useSortable({ id: status, data: { type: 'column' } });

  return (
    <div ref={setNodeRef} className={`border-t-2 ${color} bg-zinc-900/30 rounded-lg p-3 space-y-2`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-400">{STATUS_LABELS[status]}</h3>
        <span className="text-xs text-zinc-600">{tasks.length}</span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableCard key={task.id} task={task} onRefresh={onRefresh} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <p className="text-xs text-zinc-700 text-center py-8">Drop here</p>
      )}
    </div>
  );
}
