import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer } from 'lucide-react';

interface FocusTimerProps {
  onComplete?: () => void;
  soundEnabled?: boolean;
}

const DURATIONS = [
  { label: '50m', seconds: 50 * 60 },
  { label: '25m', seconds: 25 * 60 },
  { label: '15m', seconds: 15 * 60 },
  { label: '5m', seconds: 5 * 60 },
];

function playBeep() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio not available
  }
}

export default function FocusTimer({ onComplete, soundEnabled = true }: FocusTimerProps) {
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[0]!.seconds);
  const [remaining, setRemaining] = useState(DURATIONS[0]!.seconds);
  const [running, setRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const durationAtStartRef = useRef<number>(selectedDuration);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const tick = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const newRemaining = Math.max(0, durationAtStartRef.current - elapsed);
    setRemaining(newRemaining);

    if (newRemaining === 0 && !completedRef.current) {
      completedRef.current = true;
      setRunning(false);
      if (soundEnabledRef.current) playBeep();
      onComplete?.();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [onComplete]);

  useEffect(() => {
    if (running) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, tick]);

  function handleStart() {
    completedRef.current = false;
    durationAtStartRef.current = remaining;
    startTimeRef.current = Date.now() - (selectedDuration - remaining) * 1000;
    setRunning(true);
  }

  function handlePause() {
    setRunning(false);
    startTimeRef.current = null;
  }

  function handleReset() {
    setRunning(false);
    startTimeRef.current = null;
    completedRef.current = false;
    setRemaining(selectedDuration);
  }

  function handleSelectDuration(secs: number) {
    setSelectedDuration(secs);
    setRemaining(secs);
    setRunning(false);
    startTimeRef.current = null;
    completedRef.current = false;
  }

  const total = selectedDuration;
  const progress = 1 - remaining / total;
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);

  // SVG ring
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);
  const done = remaining === 0;

  return (
    <div
      data-focus-timer-running={running || undefined}
      className="flex items-center gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg transition-all duration-200"
    >
      <div className="relative flex-shrink-0">
        <svg width={72} height={72} className="-rotate-90">
          <circle cx={36} cy={36} r={r} fill="none" stroke="#27272a" strokeWidth={4} />
          <circle
            cx={36}
            cy={36}
            r={r}
            fill="none"
            stroke={done ? '#10b981' : '#f59e0b'}
            strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {done ? (
            <span className="text-emerald-400 text-xs font-semibold">Done</span>
          ) : (
            <span
              data-focus-timer-display
              className="text-zinc-100 text-sm font-mono font-semibold tabular-nums"
            >
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {/* Duration picker */}
        <div className="flex gap-1">
          {DURATIONS.map((d) => (
            <button
              key={d.seconds}
              onClick={() => handleSelectDuration(d.seconds)}
              disabled={running}
              className={`px-2 py-0.5 text-xs rounded transition-colors duration-150 disabled:opacity-40 ${
                selectedDuration === d.seconds
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Timer className="w-3 h-3 text-zinc-600" />
          {!running && !done && (
            <button
              onClick={handleStart}
              className="px-3 py-1 text-xs bg-amber-600/20 text-amber-400 border border-amber-700/40 rounded hover:bg-amber-600/30 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-amber-600"
            >
              {remaining === selectedDuration ? 'Start' : 'Resume'}
            </button>
          )}
          {running && (
            <button
              onClick={handlePause}
              className="px-3 py-1 text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 rounded hover:bg-zinc-700 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              Pause
            </button>
          )}
          {(remaining < selectedDuration || done) && (
            <button
              onClick={handleReset}
              className="px-3 py-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors duration-150"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
