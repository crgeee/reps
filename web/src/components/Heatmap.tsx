import { useMemo, useState } from 'react';

interface HeatmapProps {
  data: Record<string, number>;
  days?: number;
}

function getColor(count: number, max: number): string {
  if (count === 0) return 'bg-zinc-800';
  const ratio = count / max;
  if (ratio <= 0.25) return 'bg-emerald-900';
  if (ratio <= 0.5) return 'bg-emerald-700';
  if (ratio <= 0.75) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Heatmap({ data, days = 365 }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const { cells, monthLabels, maxCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build array of dates from oldest to newest (days total)
    const dates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d);
    }

    const maxCount = Math.max(...Object.values(data), 1);

    // Pad to start on Sunday
    const firstDay = dates[0]!.getDay(); // 0=Sun
    const paddedDates: (Date | null)[] = [...Array(firstDay).fill(null), ...dates];

    // Group into weeks (columns)
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < paddedDates.length; i += 7) {
      weeks.push(paddedDates.slice(i, i + 7));
    }

    // Month labels: find first week of each month
    const monthLabels: { col: number; label: string }[] = [];
    weeks.forEach((week, col) => {
      const firstReal = week.find((d) => d !== null);
      if (!firstReal) return;
      if (firstReal.getDate() <= 7) {
        monthLabels.push({ col, label: MONTHS[firstReal.getMonth()]! });
      }
    });

    return { cells: weeks, monthLabels, maxCount };
  }, [data, days]);

  function toDateString(d: Date): string {
    return d.toISOString().split('T')[0]!;
  }

  return (
    <div className="relative select-none">
      {/* Month labels */}
      <div className="flex mb-1 ml-6" style={{ gap: 2 }}>
        {cells.map((_, colIdx) => {
          const label = monthLabels.find((m) => m.col === colIdx);
          return (
            <div key={colIdx} className="w-3 flex-shrink-0">
              {label && (
                <span className="text-[9px] text-zinc-600 leading-none">{label.label}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {DAYS.map((day, i) => (
            <div key={day} className="w-4 h-3 flex items-center justify-end">
              {i % 2 === 1 && (
                <span className="text-[9px] text-zinc-600 leading-none">{day.charAt(0)}</span>
              )}
            </div>
          ))}
        </div>

        {/* Grid */}
        {cells.map((week, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-0.5">
            {week.map((date, rowIdx) => {
              if (!date) {
                return <div key={rowIdx} className="w-3 h-3" />;
              }
              const dateStr = toDateString(date);
              const count = data[dateStr] ?? 0;
              const color = getColor(count, maxCount);

              return (
                <div
                  key={rowIdx}
                  className={`w-3 h-3 rounded-sm cursor-default transition-all duration-200 hover:ring-1 hover:ring-zinc-400 ${color}`}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ date: dateStr, count, x: rect.left, y: rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 ml-6">
        <span className="text-[9px] text-zinc-600 mr-1">Less</span>
        {[
          'bg-zinc-800',
          'bg-emerald-900',
          'bg-emerald-700',
          'bg-emerald-500',
          'bg-emerald-400',
        ].map((c) => (
          <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-[9px] text-zinc-600 ml-1">More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 pointer-events-none shadow-lg"
          style={{ left: tooltip.x + 16, top: tooltip.y - 32 }}
        >
          {tooltip.count} review{tooltip.count !== 1 ? 's' : ''} on {tooltip.date}
        </div>
      )}
    </div>
  );
}
