import { useState, memo } from 'react';
import type { Task, Topic } from '../types';
import { TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { updateTask, deleteTask, addNote, getTaskEventUrl } from '../api';
import { logger } from '../logger';
import TagBadge from './TagBadge';
import NotesList from './NotesList';

const TOPIC_BORDER_COLORS: Record<Topic, string> = {
  coding: 'border-l-blue-500',
  'system-design': 'border-l-purple-500',
  behavioral: 'border-l-green-500',
  papers: 'border-l-amber-500',
  custom: 'border-l-slate-500',
};

interface TaskCardProps {
  task: Task;
  onRefresh: () => void;
  compact?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onEdit?: (task: Task) => void;
}

export default memo(function TaskCard({
  task,
  onRefresh,
  compact,
  dragHandleProps,
  onEdit,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleMarkDone() {
    setSubmitting(true);
    try {
      await updateTask(task.id, { completed: !task.completed });
      onRefresh();
    } catch (err) {
      logger.error('Failed to toggle task completion', { taskId: task.id, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    setSubmitting(true);
    try {
      await deleteTask(task.id);
      onRefresh();
    } catch (err) {
      logger.error('Failed to delete task', { taskId: task.id, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`border-l-2 ${TOPIC_BORDER_COLORS[task.topic]} bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors`}
    >
      <div className="flex items-center gap-2 px-3 py-1.5" {...dragHandleProps}>
        {/* Checkbox */}
        <button
          onClick={handleMarkDone}
          disabled={submitting}
          className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            task.completed
              ? 'bg-green-600 border-green-600'
              : 'border-zinc-600 hover:border-zinc-400'
          }`}
        >
          {task.completed && (
            <svg
              className="w-2 h-2 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>

        {/* Title */}
        <button
          onClick={() => (onEdit ? onEdit(task) : setExpanded(!expanded))}
          className="flex-1 text-left min-w-0"
        >
          <span
            className={`text-xs truncate block ${task.completed ? 'line-through text-zinc-600' : 'text-zinc-200'}`}
          >
            {task.title}
          </span>
        </button>

        {/* Inline tags */}
        {!compact && task.tags && task.tags.length > 0 && (
          <div className="flex gap-0.5 flex-shrink-0 hidden sm:flex">
            {task.tags.slice(0, 2).map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" />
            ))}
            {task.tags.length > 2 && (
              <span className="text-[9px] text-zinc-500 font-mono">+{task.tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Meta — inline monospace stats */}
        {!compact && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tabular-nums flex-shrink-0 hidden sm:flex">
            <span className={`w-1.5 h-1.5 rounded-full ${TOPIC_COLORS[task.topic]}`} />
            <span>{TOPIC_LABELS[task.topic]}</span>
            <span>EF{task.easeFactor.toFixed(1)}</span>
            <span>×{task.repetitions}</span>
            {task.deadline && <span className="text-zinc-500">dl {task.deadline}</span>}
          </div>
        )}

        {compact && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TOPIC_COLORS[task.topic]}`} />
        )}

        {/* Notes count */}
        {task.notes.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 text-[10px] font-mono"
          >
            {task.notes.length}n
          </button>
        )}

        {/* Add to Calendar */}
        <a
          href={getTaskEventUrl(task.id)}
          download
          className="text-zinc-500 hover:text-amber-400 transition-colors p-0.5 flex-shrink-0"
          title="Add to calendar"
          onClick={(e) => e.stopPropagation()}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </a>

        {/* Copy to clipboard */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const text = `${task.title}\nTopic: ${task.topic}\nNext Review: ${task.nextReview}\nEF: ${task.easeFactor.toFixed(1)} | Reps: ${task.repetitions}${task.notes.length > 0 ? '\n\nNotes:\n' + task.notes.map((n) => `- ${n.text}`).join('\n') : ''}`;
            await navigator.clipboard.writeText(text);
          }}
          className="text-zinc-500 hover:text-blue-400 transition-colors p-0.5 flex-shrink-0"
          title="Copy to clipboard"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={submitting}
          className="text-zinc-600 hover:text-red-400 transition-colors p-0.5 flex-shrink-0"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Mobile meta row */}
      {!compact && (
        <div className="flex items-center gap-2 px-3 pb-1.5 text-[10px] text-zinc-500 font-mono tabular-nums sm:hidden">
          <span className={`w-1.5 h-1.5 rounded-full ${TOPIC_COLORS[task.topic]}`} />
          <span>{TOPIC_LABELS[task.topic]}</span>
          <span>EF{task.easeFactor.toFixed(1)}</span>
          <span>×{task.repetitions}</span>
        </div>
      )}

      {expanded && (
        <div className="anim-expand-down border-t border-zinc-800/50 px-3 py-2">
          <NotesList
            notes={task.notes}
            onAddNote={async (text) => {
              await addNote(task.id, text);
              onRefresh();
            }}
          />
        </div>
      )}
    </div>
  );
});
