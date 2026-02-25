import { useState } from 'react';
import type { Topic } from '../types';
import { TOPICS, TOPIC_LABELS } from '../types';
import { createTask } from '../api';

interface AddTaskProps {
  onCreated: () => void;
}

export default function AddTask({ onCreated }: AddTaskProps) {
  const [topic, setTopic] = useState<Topic>('coding');
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await createTask({
        topic,
        title: title.trim(),
        deadline: deadline || undefined,
        note: note.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Add Task</h1>

      {error && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Topic</label>
          <div className="grid grid-cols-5 gap-2">
            {TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  topic === t
                    ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                {TOPIC_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-400 mb-2">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. LRU Cache implementation"
            required
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Deadline */}
        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-zinc-400 mb-2">
            Deadline (optional)
          </label>
          <input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
          />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="note" className="block text-sm font-medium text-zinc-400 mb-2">
            Note (optional)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Initial thoughts, links, resources..."
            rows={4}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-y"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="w-full py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
}
