import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Collection, CollectionStatus } from '../types';
import { COLOR_SWATCHES } from '../types';
import {
  updateCollection,
  deleteCollection,
  createCollectionStatus,
  updateCollectionStatus,
  deleteCollectionStatus,
} from '../api';

interface CollectionEditModalProps {
  collection: Collection;
  onSaved: (updated: Collection) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

const ICON_OPTIONS = ['', '📚', '💻', '🎯', '🧠', '📝', '🔬', '🎨', '⚡', '🏆', '📊', '🔧'];

function SwatchPicker({
  selected,
  onSelect,
  size = 'md',
}: {
  selected: string | null;
  onSelect: (color: string) => void;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  const ringOffset = size === 'sm' ? 'ring-offset-1 ring-offset-zinc-800' : 'ring-offset-2 ring-offset-zinc-900';
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={`${sizeClass} rounded-full transition-all duration-150 ${
            selected === c ? `ring-2 ring-zinc-400 ${ringOffset}${size === 'md' ? ' scale-110' : ''}` : ''
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export default function CollectionEditModal({
  collection,
  onSaved,
  onDeleted,
  onClose,
}: CollectionEditModalProps) {
  const [name, setName] = useState(collection.name);
  const [icon, setIcon] = useState(collection.icon ?? '');
  const [color, setColor] = useState(collection.color ?? '#71717a');
  const [srEnabled, setSrEnabled] = useState(collection.srEnabled);
  const [statuses, setStatuses] = useState<CollectionStatus[]>(collection.statuses ?? []);
  const [saving, setSaving] = useState(false);
  const [statusColorPicker, setStatusColorPicker] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateCollection(collection.id, {
        name: name.trim(),
        color,
        srEnabled,
        icon: icon || undefined,
      });
      const updated: Collection = {
        ...collection,
        name: name.trim(),
        icon: icon || undefined,
        color,
        srEnabled,
        statuses,
      };
      onSaved(updated);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCollection() {
    if (!confirm('Delete this collection and all its tasks?')) return;
    try {
      await deleteCollection(collection.id);
      onDeleted(collection.id);
      onClose();
    } catch {
      // silently fail
    }
  }

  async function handleAddStatus() {
    try {
      const created = await createCollectionStatus(collection.id, {
        name: 'New Status',
        sortOrder: statuses.length,
      });
      setStatuses((prev) => [...prev, created]);
    } catch {
      // silently fail
    }
  }

  async function handleUpdateStatusName(statusId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const updated = await updateCollectionStatus(collection.id, statusId, { name: trimmed });
      setStatuses((prev) => prev.map((s) => (s.id === statusId ? updated : s)));
    } catch {
      // silently fail
    }
  }

  async function handleUpdateStatusColor(statusId: string, newColor: string | null) {
    try {
      const updated = await updateCollectionStatus(collection.id, statusId, { color: newColor });
      setStatuses((prev) => prev.map((s) => (s.id === statusId ? updated : s)));
      setStatusColorPicker(null);
    } catch {
      // silently fail
    }
  }

  async function handleDeleteStatus(statusId: string) {
    try {
      await deleteCollectionStatus(collection.id, statusId);
      setStatuses((prev) => prev.filter((s) => s.id !== statusId));
    } catch {
      // silently fail
    }
  }

  return (
    <div
      className="anim-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit collection"
        className="anim-modal-enter bg-zinc-900 border border-zinc-700 rounded-t-xl sm:rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Edit Collection</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Name + Icon row */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${
                    icon === ic
                      ? 'bg-zinc-700 ring-2 ring-zinc-500 ring-offset-1 ring-offset-zinc-900'
                      : 'bg-zinc-800 hover:bg-zinc-750 border border-zinc-700'
                  }`}
                >
                  {ic || (
                    <span className="text-zinc-500 text-xs">-</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color swatches */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Color</label>
          <SwatchPicker selected={color} onSelect={setColor} />
        </div>

        {/* SR toggle */}
        <label className="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={srEnabled}
            onChange={(e) => setSrEnabled(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Spaced repetition
        </label>

        {/* Custom Statuses */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-medium">
            Statuses ({statuses.length})
          </label>
          <div className="space-y-2">
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center gap-2">
                {/* Color dot / picker */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setStatusColorPicker(statusColorPicker === status.id ? null : status.id)
                    }
                    className="w-5 h-5 rounded-full border border-zinc-600 flex-shrink-0"
                    style={{ backgroundColor: status.color ?? '#71717a' }}
                  />
                  {statusColorPicker === status.id && (
                    <div className="absolute top-7 left-0 z-10 bg-zinc-800 border border-zinc-700 rounded-lg p-2 w-48">
                      <SwatchPicker
                        selected={status.color}
                        onSelect={(c) => handleUpdateStatusColor(status.id, c)}
                        size="sm"
                      />
                    </div>
                  )}
                </div>

                {/* Editable name */}
                <input
                  type="text"
                  defaultValue={status.name}
                  onBlur={(e) => handleUpdateStatusName(status.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                />

                {/* Delete button */}
                {statuses.length > 1 && (
                  <button
                    onClick={() => handleDeleteStatus(status.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleAddStatus}
            className="mt-2.5 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add status
          </button>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800">
          <button
            onClick={handleDeleteCollection}
            className="text-sm text-red-400 hover:text-red-300 transition-colors py-2 sm:py-0"
          >
            Delete collection
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex-1 sm:flex-initial px-5 py-2 bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
