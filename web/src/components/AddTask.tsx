import { useState } from 'react';
import type { Tag, Collection } from '../types';
import { TOPICS, TOPIC_LABELS } from '../types';
import { createTask, createTag } from '../api';
import { logger } from '../logger';
import TagPicker from './TagPicker';

interface AddTaskProps {
  onCreated: () => void;
  availableTags?: Tag[];
  onTagCreated?: (tag: Tag) => void;
  activeCollection?: Collection | null;
}

export default function AddTask({
  onCreated,
  availableTags = [],
  onTagCreated,
  activeCollection,
}: AddTaskProps) {
  const collectionTopics = activeCollection?.topics ?? [];
  const useCollectionTopics = collectionTopics.length > 0;
  const topicOptions = useCollectionTopics
    ? collectionTopics.map((t) => ({ value: t.name, label: t.name, color: t.color }))
    : TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t], color: null }));

  const defaultTopic = activeCollection?.topics?.[0]?.name ?? 'coding';
  const [topic, setTopic] = useState<string>(defaultTopic);
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
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
        collectionId: activeCollection?.id ?? undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });
      onCreated();
    } catch (err) {
      logger.error('Failed to create task', { topic, title, error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateTag(name: string, color: string): Promise<Tag> {
    const tag = await createTag({ name, color });
    onTagCreated?.(tag);
    return tag;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-lg font-bold tracking-tight">Add Task</h1>

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Topic</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {topicOptions.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTopic(t.value)}
                className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 ${
                  topic === t.value
                    ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                {t.label}
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
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-200"
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
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 [color-scheme:dark] transition-all duration-200"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Tags (optional)</label>
          <TagPicker
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
            availableTags={availableTags}
            onCreateTag={handleCreateTag}
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
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-y transition-all duration-200"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="w-full py-3 bg-amber-500 text-zinc-950 font-bold rounded-lg hover:bg-amber-400 transition-all duration-200 disabled:opacity-50 glow-amber"
        >
          {submitting ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
}
