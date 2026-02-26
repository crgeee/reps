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

export default function CollectionEditModal({
  collection,
  onSaved,
  onDeleted,
  onClose,
}: CollectionEditModalProps) {
  const [name, setName] = useState(collection.name);
  const [color, setColor] = useState(collection.color ?? '#71717a');
  const [srEnabled, setSrEnabled] = useState(collection.srEnabled);
  const [statuses, setStatuses] = useState<CollectionStatus[]>(collection.statuses ?? []);
  const [saving, setSaving] = useState(false);
  const [statusColorPicker, setStatusColorPicker] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateCollection(collection.id, { name: name.trim(), color, srEnabled });
      const updated: Collection = {
        ...collection,
        name: name.trim(),
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
      className="anim-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="anim-modal-enter bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Edit Collection</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Name input */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Color swatches */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Color</label>
          <div className="flex gap-1.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-all duration-150 ${
                  color === c ? 'ring-2 ring-zinc-400 ring-offset-1 ring-offset-zinc-900' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* SR toggle */}
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
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
          <label className="block text-xs text-zinc-500 mb-2">
            Statuses ({statuses.length})
          </label>
          <div className="space-y-1.5">
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center gap-2">
                {/* Color dot / picker */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setStatusColorPicker(statusColorPicker === status.id ? null : status.id)
                    }
                    className="w-4 h-4 rounded-full border border-zinc-600 flex-shrink-0"
                    style={{ backgroundColor: status.color ?? '#71717a' }}
                  />
                  {statusColorPicker === status.id && (
                    <div className="absolute top-6 left-0 z-10 bg-zinc-800 border border-zinc-700 rounded-lg p-2 flex gap-1">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleUpdateStatusColor(status.id, c)}
                          className={`w-5 h-5 rounded-full transition-all ${
                            status.color === c
                              ? 'ring-2 ring-zinc-400 ring-offset-1 ring-offset-zinc-800'
                              : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
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
                  className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                />

                {/* Delete button */}
                {statuses.length > 1 && (
                  <button
                    onClick={() => handleDeleteStatus(status.id)}
                    className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleAddStatus}
            className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add status
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <button
            onClick={handleDeleteCollection}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Delete collection
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-1.5 bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
