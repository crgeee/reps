import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
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
    data: { type: 'card', task, status: task.status },
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
  // Track which column a card is currently hovering over for optimistic column assignment
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Group tasks into columns, but move the active card to the hovered column for visual feedback
  const columns = STATUSES.reduce<Record<TaskStatus, Task[]>>((acc, status) => {
    acc[status] = filtered.filter((t) => {
      if (t.id === activeId && overColumn) {
        return status === overColumn;
      }
      return t.status === status;
    });
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumn(null);
      return;
    }

    // Determine which column we're over
    if (over.data.current?.type === 'column') {
      setOverColumn(over.id as TaskStatus);
    } else if (over.data.current?.type === 'card') {
      setOverColumn(over.data.current.status as TaskStatus);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumn(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target status from what we dropped on
    let targetStatus: TaskStatus | undefined;

    if (over.data.current?.type === 'column') {
      targetStatus = over.id as TaskStatus;
    } else if (over.data.current?.type === 'card') {
      targetStatus = over.data.current.status as TaskStatus;
    }

    if (!targetStatus || targetStatus === task.status) return;

    try {
      await updateTask(taskId, { status: targetStatus });
      onRefresh();
    } catch (err) {
      logger.error('Failed to update task status', { taskId, targetStatus, error: String(err) });
      onRefresh();
    }
  }, [tasks, onRefresh]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumn(null);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Board</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} hideStatus />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
              isOver={overColumn === status}
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
  isOver,
}: {
  status: TaskStatus;
  tasks: Task[];
  onRefresh: () => void;
  color: string;
  isOver: boolean;
}) {
  const { setNodeRef, isOver: droppableIsOver } = useDroppable({
    id: status,
    data: { type: 'column' },
  });

  const highlight = isOver || droppableIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`border-t-2 ${color} rounded-lg p-3 space-y-2 transition-colors ${
        highlight ? 'bg-zinc-800/50' : 'bg-zinc-900/30'
      }`}
    >
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
        <p className={`text-xs text-center py-8 ${highlight ? 'text-zinc-500' : 'text-zinc-700'}`}>
          Drop here
        </p>
      )}
    </div>
  );
}
