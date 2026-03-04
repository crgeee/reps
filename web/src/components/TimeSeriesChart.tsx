interface HourData {
  hour: string;
  info: number;
  warn: number;
  error: number;
  total: number;
}

interface TimeSeriesChartProps {
  data: HourData[];
}

const LEGEND_ITEMS = [
  { label: 'Info', className: 'bg-blue-500 opacity-70' },
  { label: 'Warn', className: 'bg-amber-500 opacity-80' },
  { label: 'Error', className: 'bg-red-500 opacity-80' },
];

export default function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const barWidth = Math.max(8, Math.floor(600 / data.length) - 2);
  const chartHeight = 120;
  const svgWidth = data.length * (barWidth + 2) + 40;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${chartHeight + 28}`}
        className="w-full"
        style={{ minWidth: Math.min(svgWidth, 400) }}
      >
        {data.map((d, i) => {
          const x = 32 + i * (barWidth + 2);
          const totalH = (d.total / maxTotal) * chartHeight;
          const errorH = (d.error / maxTotal) * chartHeight;
          const warnH = (d.warn / maxTotal) * chartHeight;
          const infoH = totalH - errorH - warnH;

          const y = chartHeight - totalH;

          return (
            <g key={d.hour}>
              {/* Info (blue) */}
              {infoH > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={infoH}
                  rx={1}
                  fill="#3b82f6"
                  opacity={0.7}
                />
              )}
              {/* Warn (amber) */}
              {warnH > 0 && (
                <rect
                  x={x}
                  y={y + infoH}
                  width={barWidth}
                  height={warnH}
                  rx={1}
                  fill="#f59e0b"
                  opacity={0.8}
                />
              )}
              {/* Error (red) */}
              {errorH > 0 && (
                <rect
                  x={x}
                  y={y + infoH + warnH}
                  width={barWidth}
                  height={errorH}
                  rx={1}
                  fill="#ef4444"
                  opacity={0.8}
                />
              )}
              {/* X-axis label — show every 3rd or 6th depending on data length */}
              {i % (data.length > 12 ? 3 : 1) === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  fontSize={9}
                >
                  {formatHourLabel(d.hour)}
                </text>
              )}
            </g>
          );
        })}
        {/* Y-axis labels */}
        <text x={0} y={10} className="fill-zinc-500" fontSize={9}>
          {maxTotal}
        </text>
        <text x={0} y={chartHeight} className="fill-zinc-500" fontSize={9}>
          0
        </text>
      </svg>
      {/* Legend */}
      <div className="flex gap-4 mt-1 px-1">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className={`w-2.5 h-2.5 rounded-sm ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatHourLabel(hour: string): string {
  // hour is truncated ISO string like "2026-03-03T14:00"
  const d = new Date(hour);
  if (isNaN(d.getTime())) return hour;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}
