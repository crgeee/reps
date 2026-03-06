import type { RecurrenceUnit } from '../types';
import { RECURRENCE_UNITS, DAY_LABELS } from '../types';

interface RecurrencePickerProps {
  interval: number | null;
  unit: RecurrenceUnit | null;
  days: number[];
  endDate: string;
  onChange: (values: {
    interval: number | null;
    unit: RecurrenceUnit | null;
    days: number[];
    endDate: string;
  }) => void;
}

const MAX_INTERVALS: Record<RecurrenceUnit, number> = {
  day: 365,
  week: 52,
  month: 12,
};

export default function RecurrencePicker({
  interval,
  unit,
  days,
  endDate,
  onChange,
}: RecurrencePickerProps) {
  const isActive = interval != null && unit != null;

  function handleToggle() {
    if (isActive) {
      onChange({ interval: null, unit: null, days: [], endDate: '' });
    } else {
      onChange({ interval: 1, unit: 'day', days: [], endDate });
    }
  }

  function handleIntervalChange(val: string) {
    const n = parseInt(val, 10);
    if (!unit) return;
    const max = MAX_INTERVALS[unit];
    if (isNaN(n) || n < 1) return;
    onChange({ interval: Math.min(n, max), unit, days, endDate });
  }

  function handleUnitChange(newUnit: RecurrenceUnit) {
    const max = MAX_INTERVALS[newUnit];
    const clampedInterval = Math.min(interval ?? 1, max);
    onChange({
      interval: clampedInterval,
      unit: newUnit,
      days: newUnit === 'week' ? days : [],
      endDate,
    });
  }

  function handleDayToggle(d: number) {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    onChange({ interval, unit, days: next, endDate });
  }

  return (
    <div className="space-y-2">
      {/* Toggle + interval/unit row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
            isActive
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          {isActive ? 'Repeat' : 'No repeat'}
        </button>

        {isActive && (
          <>
            <span className="text-xs text-zinc-500">Every</span>
            <input
              type="number"
              min={1}
              max={unit ? MAX_INTERVALS[unit] : 365}
              value={interval ?? 1}
              onChange={(e) => handleIntervalChange(e.target.value)}
              className="w-16 px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 text-center focus:outline-none focus:border-zinc-500"
            />
            <select
              value={unit ?? 'day'}
              onChange={(e) => handleUnitChange(e.target.value as RecurrenceUnit)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              {RECURRENCE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Day-of-week pills (only for weekly) */}
      {isActive && unit === 'week' && (
        <div className="flex gap-1">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleDayToggle(i)}
              className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                days.includes(i)
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* End date */}
      {isActive && (
        <div>
          <label className="block text-xs text-zinc-500 mb-1">End date (optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChange({ interval, unit, days, endDate: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
          />
        </div>
      )}
    </div>
  );
}
