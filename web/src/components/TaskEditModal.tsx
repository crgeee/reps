import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type {
  Task,
  Collection,
  Tag,
  Priority,
  RecurrenceUnit,
  CollectionStatus,
  CustomTopic,
  TaskAlert,
} from '../types';
import {
  TOPICS,
  getTopicLabel,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatStatusLabel,
} from '../types';
import {
  updateTask,
  deleteTask,
  addNote,
  createTag,
  getTaskAlerts,
  createTaskAlert,
  deleteTaskAlert,
} from '../api';
import { logger } from '../logger';
import { maybeCreateCustomTopic } from '../lib/custom-topics';
import TagPicker from './TagPicker';
import RecurrencePicker from './RecurrencePicker';
import NotesList from './NotesList';
import ButtonSpinner from './ButtonSpinner';

interface TaskEditModalProps {
  task: Task;
  collections: Collection[];
  availableTags: Tag[];
  customTopics?: CustomTopic[];
  onSaved: () => void;
  onClose: () => void;
  onTagCreated?: (tag: Tag) => void;
  onCustomTopicCreated?: (topic: CustomTopic) => void;
}

const DEFAULT_STATUSES = ['todo', 'in-progress', 'review', 'done'];

export default function TaskEditModal({
  task,
  collections,
  availableTags,
  customTopics = [],
  onSaved,
  onClose,
  onTagCreated,
  onCustomTopicCreated,
}: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [topic, setTopic] = useState<string>(task.topic);
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [collectionId, setCollectionId] = useState<string>(task.collectionId ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number | null>(
    task.recurrenceInterval ?? null,
  );
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit | null>(
    task.recurrenceUnit ?? null,
  );
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(task.recurrenceDay ?? []);
  const [recurrenceEnd, setRecurrenceEnd] = useState(task.recurrenceEnd ?? '');
  const [tagIds, setTagIds] = useState<string[]>(task.tags?.map((t) => t.id) ?? []);
  const [notes, setNotes] = useState(task.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<TaskAlert[]>([]);
  const [alertDate, setAlertDate] = useState('');
  const [alertTime, setAlertTime] = useState('');
  const [alertLoading, setAlertLoading] = useState(false);

  useEffect(() => {
    if (task?.id) {
      getTaskAlerts(task.id)
        .then(setAlerts)
        .catch(() => {});
    }
  }, [task?.id]);

  const handleAddAlert = async () => {
    if (!task || !alertDate || !alertTime) return;
    setAlertLoading(true);
    try {
      const alertAt = new Date(`${alertDate}T${alertTime}`).toISOString();
      const alert = await createTaskAlert(task.id, alertAt);
      setAlerts((prev) => [...prev, alert].sort((a, b) => a.alertAt.localeCompare(b.alertAt)));
      setAlertDate('');
      setAlertTime('');
    } finally {
      setAlertLoading(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!task) return;
    await deleteTaskAlert(task.id, alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Derive statuses from collection
  const activeCollection = collectionId ? collections.find((c) => c.id === collectionId) : null;
  const statusOptions: string[] =
    activeCollection?.statuses && activeCollection.statuses.length > 0
      ? activeCollection.statuses
          .slice()
          .sort((a: CollectionStatus, b: CollectionStatus) => a.sortOrder - b.sortOrder)
          .map((s: CollectionStatus) => s.name)
      : DEFAULT_STATUSES;

  // Derive topic options from collection + user custom topics, with current topic always included
  const collectionTopicNames = activeCollection?.topics?.map((t) => t.name) ?? [];
  const useCollectionTopics = collectionTopicNames.length > 0;
  const topicList: string[] = useCollectionTopics
    ? collectionTopicNames
    : [
        ...TOPICS,
        ...customTopics
          .filter((ct) => !TOPICS.includes(ct.name as (typeof TOPICS)[number]))
          .map((ct) => ct.name),
      ];
  const topicOptions = topicList.includes(topic) ? topicList : [topic, ...topicList];

  async function handleSave() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateTask(task.id, {
        title: title.trim(),
        topic,
        status: status as Task['status'],
        priority,
        deadline: deadline || undefined,
        collectionId: collectionId || undefined,
        description: description || undefined,
        recurrenceInterval: recurrenceInterval ?? undefined,
        recurrenceUnit: recurrenceUnit ?? undefined,
        recurrenceDay: recurrenceDays.length > 0 ? recurrenceDays : undefined,
        recurrenceEnd: recurrenceEnd || undefined,
        tagIds,
      } as Partial<Task> & { tagIds?: string[] });
      maybeCreateCustomTopic({
        topic,
        showCustomTopic,
        customTopics,
        useCollectionTopics,
        onCreated: onCustomTopicCreated,
      });
      onSaved();
      onClose();
    } catch (err) {
      logger.error('Failed to save task', { taskId: task.id, error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTask(task.id);
      onSaved();
      onClose();
    } catch (err) {
      logger.error('Failed to delete task', { taskId: task.id, error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddNote(text: string) {
    setError(null);
    try {
      await addNote(task.id, text);
      setNotes((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, createdAt: new Date().toISOString().slice(0, 10) },
      ]);
      onSaved();
    } catch (err) {
      logger.error('Failed to add note', { taskId: task.id, error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to add note');
    }
  }

  async function handleCreateTag(name: string, color: string): Promise<Tag> {
    const tag = await createTag({ name, color });
    onTagCreated?.(tag);
    return tag;
  }

  return (
    <div
      className="anim-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit task: ${task.title}`}
        className="anim-modal-enter bg-zinc-900 border border-zinc-700 rounded-t-xl sm:rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5"
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
            aria-label="Close"
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Topic pills */}
        <div className="flex flex-wrap gap-1.5">
          {topicOptions.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTopic(t);
                setShowCustomTopic(false);
              }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                topic === t && !showCustomTopic
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50'
              }`}
            >
              {getTopicLabel(t)}
            </button>
          ))}
          <button
            onClick={() => setShowCustomTopic(true)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              showCustomTopic
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50'
            }`}
          >
            + Custom
          </button>
        </div>
        {showCustomTopic && (
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter custom topic name"
            autoFocus
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status */}
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
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
            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
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
            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
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
            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
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
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recurrence */}
        <div>
          <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
            Recurrence
          </label>
          <RecurrencePicker
            interval={recurrenceInterval}
            unit={recurrenceUnit}
            days={recurrenceDays}
            endDate={recurrenceEnd}
            onChange={({ interval, unit, days, endDate }) => {
              setRecurrenceInterval(interval);
              setRecurrenceUnit(unit);
              setRecurrenceDays(days);
              setRecurrenceEnd(endDate);
            }}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
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
          <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
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
          <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
            Notes
          </label>
          <NotesList notes={notes} onAddNote={handleAddNote} />
        </div>

        {/* Task Alerts */}
        <div className="space-y-2">
          <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">
            Reminders
          </label>
          {alerts
            .filter((a) => !a.sent)
            .map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between text-sm bg-zinc-800/50 rounded px-3 py-2"
              >
                <span className="text-zinc-300">{new Date(alert.alertAt).toLocaleString()}</span>
                <button
                  onClick={() => handleDeleteAlert(alert.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          <div className="flex gap-2">
            <input
              type="date"
              value={alertDate}
              onChange={(e) => setAlertDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
            />
            <input
              type="time"
              value={alertTime}
              onChange={(e) => setAlertTime(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
            />
            <button
              onClick={handleAddAlert}
              disabled={!alertDate || !alertTime || alertLoading}
              className="text-sm text-blue-400 hover:text-blue-300 disabled:text-zinc-600"
            >
              Add
            </button>
          </div>
        </div>

        {/* SM-2 info */}
        <div className="flex flex-wrap gap-4 text-[10px] text-zinc-500">
          <span>EF: {task.easeFactor.toFixed(2)}</span>
          <span>Reps: {task.repetitions}</span>
          <span>Interval: {task.interval}d</span>
          <span>Next review: {task.nextReview}</span>
          {task.lastReviewed && <span>Last reviewed: {task.lastReviewed}</span>}
          <span>Created: {task.createdAt}</span>
        </div>

        {/* Error */}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <button
            onClick={handleDelete}
            disabled={busy}
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
              disabled={busy || !title.trim()}
              className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {busy && <ButtonSpinner />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
