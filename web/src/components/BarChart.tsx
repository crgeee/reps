interface BarChartProps {
  data: Record<string, number>;
  colors?: Record<string, string>;
}

export default function BarChart({ data, colors }: BarChartProps) {
  const entries = Object.entries(data);
  const maxValue = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => {
        const pct = (value / maxValue) * 100;
        const barColor = colors?.[label] ?? 'bg-zinc-500';
        return (
          <div key={label} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-28 flex-shrink-0 text-right truncate">
              {label}
            </span>
            <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 w-6 text-right flex-shrink-0">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
