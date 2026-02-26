import type { Tag } from '../types';

interface TagBadgeProps {
  tag: Tag;
  size?: 'sm' | 'md';
}

export default function TagBadge({ tag, size = 'md' }: TagBadgeProps) {
  const sizeClasses =
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px] gap-1' : 'px-2 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 transition-all duration-200 ${sizeClasses}`}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{
          width: size === 'sm' ? 5 : 6,
          height: size === 'sm' ? 5 : 6,
          backgroundColor: tag.color,
        }}
      />
      {tag.name}
    </span>
  );
}
