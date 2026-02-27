import { useState, useEffect, useCallback } from 'react';
import type { CollectionTemplate, Collection } from '../types';
import { COLOR_SWATCHES } from '../types';
import { createCollectionFromTemplate } from '../api';

interface CreateFromTemplateProps {
  template: CollectionTemplate;
  onCreated: (collection: Collection) => void;
  onClose: () => void;
}

export default function CreateFromTemplate({
  template,
  onCreated,
  onClose,
}: CreateFromTemplateProps) {
  const [name, setName] = useState(template.name);
  const [color, setColor] = useState<string>(template.color ?? COLOR_SWATCHES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  async function handleCreate() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const collection = await createCollectionFromTemplate({
        templateId: template.id,
        name: name.trim(),
        color,
      });
      onCreated(collection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-5">
          {template.icon && <span className="text-2xl leading-none">{template.icon}</span>}
          <h2 className="text-lg font-semibold text-zinc-100">Create from {template.name}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Collection name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={`w-8 h-8 rounded-full transition-all duration-150 flex-shrink-0 ${
                    color === c ? 'ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-900' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs text-zinc-400 mb-1.5">Will create:</span>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {template.statuses.map((status) => (
                <span
                  key={status.id}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: status.color
                      ? `${status.color}33`
                      : 'rgba(113, 113, 122, 0.2)',
                    color: status.color ?? '#a1a1aa',
                  }}
                >
                  {status.name}
                </span>
              ))}
            </div>
            {template.tasks.length > 0 && (
              <p className="text-xs text-zinc-500">
                {template.tasks.length} starter {template.tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={!name.trim() || submitting}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              )}
              Create Collection
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
