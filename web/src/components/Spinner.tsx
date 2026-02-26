import { memo } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZES = {
  sm: { box: 'w-5 h-5', border: 'border-2' },
  md: { box: 'w-8 h-8', border: 'border-[3px]' },
  lg: { box: 'w-12 h-12', border: 'border-4' },
};

export default memo(function Spinner({ size = 'md', label }: SpinnerProps) {
  const s = SIZES[size];
  return (
    <div role="status" aria-label={label ?? 'Loading'} className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          aria-hidden="true"
          className={`${s.box} ${s.border} rounded-full border-zinc-800 border-t-zinc-300 animate-spin`}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${s.box} ${s.border} rounded-full border-transparent border-b-zinc-600 animate-spin`}
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
        />
      </div>
      {label && <p className="text-sm text-zinc-500 animate-pulse">{label}</p>}
    </div>
  );
});
