import { useState, useRef, useCallback } from 'react';
import { Tag as TagIcon } from 'lucide-react';
import type { Tag } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

interface TagPickerProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  availableTags: Tag[];
  onCreateTag?: (name: string, color: string) => Promise<Tag>;
}

const TAG_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
  '#14b8a6',
];

export default function TagPicker({
  selectedTagIds,
  onChange,
  availableTags,
  onCreateTag,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]!);
  const [savingTag, setSavingTag] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(
    ref,
    useCallback(() => {
      setOpen(false);
      setCreating(false);
    }, []),
  );

  const filtered = availableTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  function toggleTag(id: string) {
    if (selectedTagIds.includes(id)) {
      onChange(selectedTagIds.filter((t) => t !== id));
    } else {
      onChange([...selectedTagIds, id]);
    }
  }

  async function handleCreateTag() {
    if (!newName.trim() || !onCreateTag) return;
    setSavingTag(true);
    try {
      const tag = await onCreateTag(newName.trim(), newColor);
      onChange([...selectedTagIds, tag.id]);
      setNewName('');
      setNewColor(TAG_COLORS[0]!);
      setCreating(false);
    } finally {
      setSavingTag(false);
    }
  }

  const selectedTags = availableTags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-left hover:border-zinc-600 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      >
        <TagIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800 rounded-full text-[10px] text-zinc-300"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-zinc-600">Add tags...</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-800">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags..."
              autoFocus
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Tag list */}
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-600">No tags found.</p>
            )}
            {filtered.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-150 ${
                    selected
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1">{tag.name}</span>
                  {selected && <span className="text-emerald-400 text-xs">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Create new tag */}
          {onCreateTag && (
            <div className="border-t border-zinc-800">
              {!creating ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-left transition-colors duration-150"
                >
                  + Create new tag
                </button>
              ) : (
                <div className="p-2 space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tag name"
                    autoFocus
                    className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                  <div className="flex flex-wrap gap-1">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewColor(color)}
                        className={`w-5 h-5 rounded-full transition-all duration-150 ${
                          newColor === color
                            ? 'ring-2 ring-zinc-300 ring-offset-1 ring-offset-zinc-900'
                            : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={savingTag || !newName.trim()}
                      className="flex-1 py-1 bg-zinc-700 text-zinc-200 text-xs rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
                    >
                      {savingTag ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="px-3 py-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
