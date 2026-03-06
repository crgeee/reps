import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { Task } from '../types';
import { getTopicLabel } from '../types';
import { useProtectedContext } from '../layouts/ProtectedLayout';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDayNumberColor(isToday: boolean, isOverdue: boolean): string {
  if (isToday) return 'text-zinc-100';
  if (isOverdue) return 'text-red-400';
  return 'text-zinc-300';
}

function getCellStyle(isSelected: boolean, isToday: boolean): string {
  if (isSelected) return 'border-zinc-400 bg-zinc-800';
  if (isToday) return 'border-zinc-500 bg-zinc-800/60';
  return 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900';
}
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Map bg- color to inline hex so we can use small dots
const TOPIC_DOT_COLORS: Record<string, string> = {
  coding: '#3b82f6',
  'system-design': '#a855f7',
  behavioral: '#22c55e',
  papers: '#f59e0b',
  custom: '#64748b',
};

function getTopicDotColor(topic: string): string {
  return TOPIC_DOT_COLORS[topic] ?? '#64748b';
}

export default function CalendarView() {
  const { filteredTasks: tasks } = useProtectedContext();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = today.toISOString().split('T')[0]!;

  // Group tasks by date (nextReview and deadline)
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.completed) {
        const dates = new Set<string>();
        if (task.nextReview) dates.add(task.nextReview);
        if (task.deadline) dates.add(task.deadline);
        for (const d of dates) {
          const existing = map.get(d) ?? [];
          // avoid duplicates if both nextReview and deadline are same
          if (!existing.find((t) => t.id === task.id)) {
            existing.push(task);
            map.set(d, existing);
          }
        }
      }
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Pad to full weeks
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  }

  function handleDayClick(day: number) {
    const dateStr = toDateStr(year, month, day);
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
  }

  const selectedTasks = selectedDate ? (tasksByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Calendar</h1>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-zinc-500" />
          <h2 className="text-lg font-semibold">
            {MONTH_NAMES[month]} {year}
          </h2>
        </div>
        <div className="flex gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth());
            }}
            className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors duration-150"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] text-zinc-400 uppercase tracking-wider py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 overflow-x-auto">
        {calendarDays.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} />;
          }
          const dateStr = toDateStr(year, month, day);
          const dayTasks = tasksByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isOverdue = dateStr < todayStr && dayTasks.length > 0;

          // Up to 3 dots
          const dots = dayTasks.slice(0, 3);

          return (
            <button
              key={dateStr}
              onClick={() => handleDayClick(day)}
              className={`min-h-12 p-1.5 rounded-lg border text-left transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-zinc-500 ${getCellStyle(isSelected, isToday)}`}
            >
              <span className={`text-xs font-medium ${getDayNumberColor(isToday, isOverdue)}`}>
                {day}
              </span>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap">
                  {dots.map((task, di) => (
                    <span
                      key={`${task.id}-${di}`}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getTopicDotColor(task.topic) }}
                      title={`${getTopicLabel(task.topic)}: ${task.title}`}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[8px] text-zinc-400">+{dayTasks.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date tasks */}
      {selectedDate && selectedTasks.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-zinc-300">{selectedDate}</p>
          {selectedTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: getTopicDotColor(task.topic) }}
              />
              <span
                className={`flex-1 ${task.nextReview < todayStr ? 'text-red-300' : 'text-zinc-300'}`}
              >
                {task.title}
              </span>
              <span className="text-xs text-zinc-400">{getTopicLabel(task.topic)}</span>
            </div>
          ))}
        </div>
      )}
      {selectedDate && selectedTasks.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">No tasks on {selectedDate}.</p>
        </div>
      )}

      {/* Topic legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {Object.entries(TOPIC_DOT_COLORS).map(([topic, color]) => (
          <div key={topic} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-zinc-400">{getTopicLabel(topic)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
