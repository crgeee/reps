import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  current: number;
  longest: number;
}

export default function StreakBadge({ current, longest }: StreakBadgeProps) {
  const active = current > 0;

  return (
    <div className="p-4 bg-zinc-900 rounded-lg flex items-center gap-3 transition-all duration-200">
      <Flame
        className={`w-8 h-8 flex-shrink-0 transition-colors duration-200 ${
          active ? 'text-amber-400' : 'text-zinc-600'
        }`}
      />
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Streak</p>
        <p className={`text-2xl font-bold leading-none ${active ? 'text-amber-400' : 'text-zinc-400'}`}>
          {current}
          <span className="text-sm font-normal ml-1 text-zinc-500">days</span>
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">longest: {longest}</p>
      </div>
    </div>
  );
}
