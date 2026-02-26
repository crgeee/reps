import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Plus, Pencil } from 'lucide-react';
import type { Collection } from '../types';
import { COLOR_SWATCHES } from '../types';
import { createCollection } from '../api';
import { useClickOutside } from '../hooks/useClickOutside';
import CollectionEditModal from './CollectionEditModal';

interface CollectionSwitcherProps {
  collections: Collection[];
  activeId: string | null;
  onChange: (id: string | null) => void;
  onCollectionCreated: (collection: Collection) => void;
  onCollectionUpdated?: (collection: Collection) => void;
  onCollectionDeleted?: (id: string) => void;
}

export default function CollectionSwitcher({
  collections,
  activeId,
  onChange,
  onCollectionCreated,
  onCollectionUpdated,
  onCollectionDeleted,
}: CollectionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(COLOR_SWATCHES[0]);
  const [newSrEnabled, setNewSrEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const active = collections.find((c) => c.id === activeId) ?? null;

  useClickOutside(ref, useCallback(() => { setOpen(false); setCreating(false); }, []));

  useEffect(() => {
    if (creating) nameInputRef.current?.focus();
  }, [creating]);

  async function handleCreate() {
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const col = await createCollection({ name: newName.trim(), color: newColor, srEnabled: newSrEnabled });
      onCollectionCreated(col);
      onChange(col.id);
      setNewName('');
      setNewSrEnabled(false);
      setCreating(false);
      setOpen(false);
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={active ? `Collection: ${active.name}` : 'All collections'}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      >
        {active ? (
          <>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: active.color ?? '#71717a' }}
            />
            <span className="max-w-32 truncate">{active.name}</span>
          </>
        ) : (
          <span className="text-zinc-500">All collections</span>
        )}
        <ChevronRight
          className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 sm:right-auto sm:left-0 z-50 min-w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={() => { onChange(null); setOpen(false); setCreating(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-150 ${
              activeId === null
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-zinc-600 flex-shrink-0" />
            All collections
          </button>
          {collections.map((col) => (
            <div key={col.id} className="group flex items-center">
              <button
                onClick={() => { onChange(col.id); setOpen(false); setCreating(false); }}
                className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-150 ${
                  activeId === col.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.color ?? '#71717a' }}
                />
                <span className="truncate">{col.name}</span>
                {!col.srEnabled && <span className="ml-auto text-[10px] text-zinc-600">no SR</span>}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingCollection(col); setOpen(false); }}
                aria-label={`Edit ${col.name}`}
                className="p-1.5 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all"
                title="Edit collection"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          ))}

          <div className="border-t border-zinc-800">
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors duration-150"
              >
                <Plus className="w-3 h-3" />
                New collection
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Collection name"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
                <div className="flex gap-1">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      aria-label={`Color ${c}`}
                      aria-pressed={newColor === c}
                      className={`w-5 h-5 rounded-full transition-all duration-150 ${
                        newColor === c ? 'ring-2 ring-zinc-400 ring-offset-1 ring-offset-zinc-900' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSrEnabled}
                    onChange={(e) => setNewSrEnabled(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  Spaced repetition
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || submitting}
                    className="flex-1 py-1.5 bg-zinc-100 text-zinc-900 text-xs font-semibold rounded hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(''); }}
                    className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {editingCollection && (
        <CollectionEditModal
          collection={editingCollection}
          onSaved={(updated) => {
            onCollectionUpdated?.(updated);
            setEditingCollection(null);
          }}
          onDeleted={(id) => {
            onCollectionDeleted?.(id);
            setEditingCollection(null);
          }}
          onClose={() => setEditingCollection(null)}
        />
      )}
    </div>
  );
}
