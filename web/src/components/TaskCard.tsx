import { useState } from 'react';
import type { Task } from '../types';
import { TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { updateTask, deleteTask, addNote } from '../api';
import { logger } from '../logger';
import TagBadge from './TagBadge';

interface TaskCardProps {
  task: Task;
  onRefresh: () => void;
  compact?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onEdit?: (task: Task) => void;
}

export default function TaskCard({ task, onRefresh, compact, dragHandleProps, onEdit }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [noteInput, setNoteInput] = useState('');
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

  async function handleAddNote() {
    const text = noteInput.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await addNote(task.id, text);
      setNoteInput('');
      onRefresh();
    } catch (err) {
      logger.error('Failed to add note', { taskId: task.id, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-3 p-3" {...dragHandleProps}>
        <button
          onClick={handleMarkDone}
          disabled={submitting}
          className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            task.completed ? 'bg-green-600 border-green-600' : 'border-zinc-600 hover:border-zinc-400'
          }`}
        >
          {task.completed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <button onClick={() => onEdit ? onEdit(task) : setExpanded(!expanded)} className="flex-1 text-left min-w-0">
          <span className={`text-sm font-medium truncate block ${task.completed ? 'line-through text-zinc-500' : ''}`}>
            {task.title}
          </span>
        </button>

        {!compact && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${TOPIC_COLORS[task.topic]}`} />
            <span>{TOPIC_LABELS[task.topic]}</span>
            {task.deadline && <span>Due: {task.deadline}</span>}
          </div>
        )}

        {compact && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TOPIC_COLORS[task.topic]}`} />
        )}

        {task.notes.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5 flex-shrink-0 text-[10px]"
          >
            {task.notes.length}
          </button>
        )}

        <button
          onClick={handleDelete}
          disabled={submitting}
          className="text-zinc-700 hover:text-red-400 transition-colors p-0.5 flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Meta row */}
      {!compact && (
        <div className="px-3 pb-2 flex flex-wrap items-center gap-3 text-[10px] text-zinc-600">
          <span>Review: {task.nextReview}</span>
          <span>EF: {task.easeFactor.toFixed(1)}</span>
          <span>Reps: {task.repetitions}</span>
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {task.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-2">
          {task.notes.length > 0 ? (
            task.notes.map((note) => (
              <div key={note.id} className="text-xs text-zinc-400 bg-zinc-800/50 rounded p-2">
                <p className="whitespace-pre-wrap">{note.text}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{note.createdAt}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-600">No notes yet.</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleAddNote}
              disabled={submitting}
              className="px-3 py-1.5 bg-zinc-700 text-zinc-200 text-xs rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
