import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  content: React.ReactNode;
  learnMoreHref?: string;
}

export default function InfoTooltip({ content, learnMoreHref }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="text-zinc-600 hover:text-zinc-400 transition-colors"
        aria-label="More info"
        type="button"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 text-[11px] text-zinc-300 leading-relaxed">
          {content}
          {learnMoreHref && (
            <a
              href={learnMoreHref}
              className="block mt-2 text-amber-500/80 hover:text-amber-400 transition-colors"
            >
              Learn more →
            </a>
          )}
        </div>
      )}
    </span>
  );
}
