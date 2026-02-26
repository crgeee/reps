import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  current: number;
  longest: number;
}

export default function StreakBadge({ current, longest }: StreakBadgeProps) {
  const active = current > 0;

  return (
    <div className={`p-4 bg-zinc-900/80 border border-zinc-800/60 rounded-lg flex items-center gap-3 transition-all duration-200 ${active ? 'border-l-[3px] border-l-amber-500' : ''}`}>
      <Flame
        className={`w-8 h-8 flex-shrink-0 transition-colors duration-200 ${
          active ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'text-zinc-600'
        }`}
      />
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5 font-medium">Streak</p>
        <p className={`text-3xl font-bold font-mono tabular-nums leading-none ${active ? 'text-amber-400' : 'text-zinc-400'}`}>
          {current}
          <span className="text-sm font-normal font-sans ml-1 text-zinc-500">days</span>
        </p>
        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">best: {longest}</p>
      </div>
    </div>
  );
}
