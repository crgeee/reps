import { useState, useRef, useCallback } from 'react';
import { ChevronRight, Plus, Pencil } from 'lucide-react';
import type { Collection } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import CollectionEditModal from './CollectionEditModal';
import CreateCollectionModal from './CreateCollectionModal';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = collections.find((c) => c.id === activeId) ?? null;

  useClickOutside(
    ref,
    useCallback(() => {
      setOpen(false);
    }, []),
  );

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
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
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
                onClick={() => {
                  onChange(col.id);
                  setOpen(false);
                }}
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
                {!col.srEnabled && <span className="ml-auto text-[10px] text-zinc-500">no SR</span>}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCollection(col);
                  setOpen(false);
                }}
                aria-label={`Edit ${col.name}`}
                className="p-2 text-zinc-500 hover:text-zinc-200 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                title="Edit collection"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <div className="border-t border-zinc-800">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors duration-150"
            >
              <Plus className="w-3 h-3" />
              New collection
            </button>
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
      {showCreateModal && (
        <CreateCollectionModal
          onCreated={(col) => {
            onCollectionCreated(col);
            onChange(col.id);
            setShowCreateModal(false);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
