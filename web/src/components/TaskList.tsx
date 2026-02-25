import { useState } from 'react';
import type { Task, Topic } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { updateTask, deleteTask, addNote } from '../api';

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
}

export default function TaskList({ tasks, onRefresh }: TaskListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [filter, setFilter] = useState<Topic | 'all'>('all');

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.topic === filter);
  const grouped = TOPICS.reduce<Record<Topic, Task[]>>((acc, topic) => {
    const topicTasks = filtered.filter((t) => t.topic === topic);
    if (topicTasks.length > 0) acc[topic] = topicTasks;
    return acc;
  }, {} as Record<Topic, Task[]>);

  async function handleMarkDone(task: Task) {
    setSubmitting(task.id);
    try {
      await updateTask(task.id, { completed: !task.completed });
      onRefresh();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return;
    setSubmitting(id);
    try {
      await deleteTask(id);
      onRefresh();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(null);
    }
  }

  async function handleAddNote(taskId: string) {
    const text = noteInputs[taskId]?.trim();
    if (!text) return;
    setSubmitting(taskId);
    try {
      await addNote(taskId, text);
      setNoteInputs((prev) => ({ ...prev, [taskId]: '' }));
      onRefresh();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <div className="flex gap-1">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterButton>
          {TOPICS.map((t) => (
            <FilterButton key={t} active={filter === t} onClick={() => setFilter(t)}>
              {TOPIC_LABELS[t]}
            </FilterButton>
          ))}
        </div>
      </div>

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
            {topicTasks.map((task) => {
              const isExpanded = expandedId === task.id;
              const isSubmitting = submitting === task.id;

              return (
                <div
                  key={task.id}
                  className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden"
                >
                  {/* Task header */}
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => handleMarkDone(task)}
                      disabled={isSubmitting}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-green-600 border-green-600'
                          : 'border-zinc-600 hover:border-zinc-400'
                      }`}
                    >
                      {task.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : task.id)}
                      className="flex-1 text-left"
                    >
                      <span
                        className={`font-medium ${task.completed ? 'line-through text-zinc-500' : ''}`}
                      >
                        {task.title}
                      </span>
                    </button>

                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      {task.deadline && <span>Due: {task.deadline}</span>}
                      <span>Review: {task.nextReview}</span>
                      <span className="text-zinc-600">EF: {task.easeFactor.toFixed(1)}</span>
                    </div>

                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={isSubmitting}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded notes */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 space-y-3">
                      {task.notes.length > 0 ? (
                        <div className="space-y-2">
                          {task.notes.map((note) => (
                            <div
                              key={note.id}
                              className="text-sm text-zinc-400 bg-zinc-800/50 rounded p-3"
                            >
                              <p className="whitespace-pre-wrap">{note.text}</p>
                              <p className="text-xs text-zinc-600 mt-1">{note.createdAt}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600">No notes yet.</p>
                      )}

                      {/* Add note input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteInputs[task.id] ?? ''}
                          onChange={(e) =>
                            setNoteInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleAddNote(task.id)}
                          placeholder="Add a note..."
                          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                        />
                        <button
                          onClick={() => handleAddNote(task.id)}
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-zinc-700 text-zinc-200 text-sm rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
        active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
      }`}
    >
      {children}
    </button>
  );
}
