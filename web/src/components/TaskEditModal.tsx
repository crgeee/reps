import { useState } from 'react';
import { X } from 'lucide-react';
import type { Task, Collection, Tag, Topic, Priority, CollectionStatus } from '../types';
import { TOPICS, TOPIC_LABELS, PRIORITIES, PRIORITY_LABELS, PRIORITY_COLORS, formatStatusLabel } from '../types';
import { updateTask, deleteTask, addNote, createTag } from '../api';
import TagPicker from './TagPicker';
import NotesList from './NotesList';

interface TaskEditModalProps {
  task: Task;
  collections: Collection[];
  availableTags: Tag[];
  onSaved: () => void;
  onClose: () => void;
  onTagCreated?: (tag: Tag) => void;
}

const DEFAULT_STATUSES = ['todo', 'in-progress', 'review', 'done'];

export default function TaskEditModal({
  task,
  collections,
  availableTags,
  onSaved,
  onClose,
  onTagCreated,
}: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [topic, setTopic] = useState<Topic>(task.topic);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [collectionId, setCollectionId] = useState<string>(task.collectionId ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [tagIds, setTagIds] = useState<string[]>(task.tags?.map((t) => t.id) ?? []);
  const [notes, setNotes] = useState(task.notes);
  const [saving, setSaving] = useState(false);

  // Derive statuses from collection
  const activeCollection = collectionId
    ? collections.find((c) => c.id === collectionId)
    : null;
  const statusOptions: string[] = activeCollection?.statuses && activeCollection.statuses.length > 0
    ? activeCollection.statuses
        .slice()
        .sort((a: CollectionStatus, b: CollectionStatus) => a.sortOrder - b.sortOrder)
        .map((s: CollectionStatus) => s.name)
    : DEFAULT_STATUSES;

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateTask(task.id, {
        title: title.trim(),
        topic,
        status: status as Task['status'],
        priority,
        deadline: deadline || undefined,
        collectionId: collectionId || undefined,
        description: description || undefined,
        tagIds,
      } as Partial<Task> & { tagIds?: string[] });
      onSaved();
      onClose();
    } catch {
      // stay open on error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    setSaving(true);
    try {
      await deleteTask(task.id);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote(text: string) {
    await addNote(task.id, text);
    setNotes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, createdAt: new Date().toISOString().slice(0, 10) },
    ]);
    onSaved();
  }

  async function handleCreateTag(name: string, color: string): Promise<Tag> {
    const tag = await createTag({ name, color });
    onTagCreated?.(tag);
    return tag;
  }

  return (
    <div
      className="anim-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="anim-modal-enter bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            className="flex-1 text-xl font-semibold bg-transparent border-none text-zinc-100 placeholder-zinc-600 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Topic pills */}
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                topic === t
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50'
              }`}
            >
              {TOPIC_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status */}
          <div>
            <label className="block text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Task['status'])}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p} className={PRIORITY_COLORS[p]}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
              Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Collection */}
          <div>
            <label className="block text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
              Collection
            </label>
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              <option value="">None</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
            Tags
          </label>
          <TagPicker
            selectedTagIds={tagIds}
            onChange={setTagIds}
            availableTags={availableTags}
            onCreateTag={handleCreateTag}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Add description..."
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
            Notes
          </label>
          <NotesList notes={notes} onAddNote={handleAddNote} />
        </div>

        {/* SM-2 info */}
        <div className="flex flex-wrap gap-4 text-[10px] text-zinc-600">
          <span>EF: {task.easeFactor.toFixed(2)}</span>
          <span>Reps: {task.repetitions}</span>
          <span>Interval: {task.interval}d</span>
          <span>Next review: {task.nextReview}</span>
          {task.lastReviewed && <span>Last reviewed: {task.lastReviewed}</span>}
          <span>Created: {task.createdAt}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            Delete task
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
