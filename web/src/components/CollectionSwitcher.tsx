import { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Collection } from '../types';

interface CollectionSwitcherProps {
  collections: Collection[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}

export default function CollectionSwitcher({
  collections,
  activeId,
  onChange,
}: CollectionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = collections.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (collections.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
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
        <div className="absolute top-full mt-1 left-0 z-50 min-w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
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
            <button
              key={col.id}
              onClick={() => { onChange(col.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-150 ${
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
              {col.icon && <span className="ml-auto text-zinc-600">{col.icon}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
