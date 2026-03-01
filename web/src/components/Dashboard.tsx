import { useState, useEffect } from 'react';
import type { Task, Streaks } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS, getTopicColor } from '../types';
import { getStreaks } from '../api';
import { Flame } from 'lucide-react';

type View =
  | 'dashboard'
  | 'tasks'
  | 'review'
  | 'add'
  | 'progress'
  | 'calendar'
  | 'export'
  | 'settings';

interface DashboardProps {
  tasks: Task[];
  dueTasks: Task[];
  onStartReview: () => void;
  onNavigate: (view: View) => void;
  onTopicClick?: (topic: string) => void;
  activeCollectionId?: string | null;
}

function isOverdue(task: Task): boolean {
  return new Date(task.nextReview) < new Date(new Date().toISOString().split('T')[0]!);
}

function daysUntil(dateStr: string): number {
  const today = new Date(new Date().toISOString().split('T')[0]!);
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function Dashboard({
  tasks,
  dueTasks,
  onStartReview,
  onNavigate,
  onTopicClick,
  activeCollectionId,
}: DashboardProps) {
  const [streaks, setStreaks] = useState<Streaks | null>(null);

  useEffect(() => {
    getStreaks(activeCollectionId ?? undefined)
      .then(setStreaks)
      .catch(() => null);
  }, [activeCollectionId]);

  const overdueTasks = dueTasks.filter(isOverdue);
  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  const topicStats = TOPICS.map((topic) => {
    const topicTasks = tasks.filter((t) => t.topic === topic);
    const done = topicTasks.filter((t) => t.completed).length;
    const due = topicTasks.filter(
      (t) => !t.completed && new Date(t.nextReview) <= new Date(),
    ).length;
    const total = topicTasks.length;
    const avgEF =
      topicTasks.length > 0
        ? topicTasks.reduce((s, t) => s + t.easeFactor, 0) / topicTasks.length
        : 0;
    return {
      topic,
      done,
      due,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      avgEF,
    };
  }).filter((s) => s.total > 0);

  const streakActive = streaks && streaks.currentStreak > 0;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Dashboard</h1>
      {/* ── Stat strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/60 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
        <StatCell label="Due" value={dueTasks.length} accent={dueTasks.length > 0} />
        <StatCell
          label="Overdue"
          value={overdueTasks.length}
          accent={overdueTasks.length > 0}
          warn
        />
        <StatCell label="Active" value={activeTasks.length} />
        <StatCell label="Done" value={completedTasks.length} />
      </div>
      {streaks && (
        <div className="flex items-center gap-2 px-4 py-2.5 border border-zinc-800 rounded-lg bg-zinc-900/60">
          <Flame
            className={`w-3.5 h-3.5 flex-shrink-0 ${streakActive ? 'text-amber-400' : 'text-zinc-500'}`}
          />
          <span
            className={`text-lg font-bold font-mono tabular-nums leading-none ${streakActive ? 'text-amber-400' : 'text-zinc-300'}`}
          >
            {streaks.currentStreak}
          </span>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">streak</span>
          <span className="text-[10px] text-zinc-500 font-mono ml-auto">
            best {streaks.longestStreak}
          </span>
        </div>
      )}

      {/* ── Overdue banner ── */}
      {overdueTasks.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-red-950/40 border border-red-900/40 rounded-lg text-sm">
          <span className="text-red-400 font-mono font-bold">{overdueTasks.length}</span>
          <span className="text-red-300/80">overdue —</span>
          <span className="text-red-300/60 truncate flex-1 font-mono text-xs">
            {overdueTasks.map((t) => t.title).join(' · ')}
          </span>
          <button
            onClick={onStartReview}
            className="text-xs text-red-300 hover:text-red-100 font-medium flex-shrink-0 underline decoration-red-800 hover:decoration-red-400 transition-colors"
          >
            Review now
          </button>
        </div>
      )}

      {/* ── Review CTA ── */}
      {dueTasks.length > 0 && (
        <button
          onClick={onStartReview}
          className="w-full flex items-center justify-between px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/15 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-200 font-semibold text-sm">Start Review Session</span>
          </div>
          <span className="text-amber-400/80 font-mono text-sm group-hover:text-amber-300 transition-colors">
            {dueTasks.length} {dueTasks.length === 1 ? 'task' : 'tasks'}
            <span className="ml-2 text-amber-400/40">→</span>
          </span>
        </button>
      )}

      {/* ── Topic breakdown ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium">
            Topics
          </h2>
          <button
            onClick={() => onNavigate('progress')}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
          >
            Details →
          </button>
        </div>
        <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
          {topicStats.map(({ topic, done, due, total, pct, avgEF }) => (
            <button
              key={topic}
              onClick={() => onTopicClick?.(topic)}
              className="flex items-center gap-3 px-3 py-2 text-xs w-full text-left hover:bg-zinc-800/40 transition-colors cursor-pointer">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TOPIC_COLORS[topic]}`} />
              <span className="text-zinc-300 w-24 truncate">{TOPIC_LABELS[topic]}</span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${TOPIC_LABELS[topic]} progress: ${pct}%`}
                  className={`h-full rounded-full ${TOPIC_COLORS[topic]} opacity-80`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-zinc-400 font-mono tabular-nums w-12 text-right">
                {done}/{total}
              </span>
              <span className="text-zinc-500 font-mono tabular-nums w-10 text-right hidden sm:inline">
                {pct}%
              </span>
              {due > 0 && (
                <span className="text-amber-500/80 font-mono tabular-nums text-[10px]">
                  {due} due
                </span>
              )}
              <span
                className="text-zinc-500 font-mono tabular-nums w-12 text-right hidden md:inline"
                title="Avg ease factor"
              >
                EF {avgEF.toFixed(1)}
              </span>
            </button>
          ))}
          {topicStats.length === 0 && (
            <div className="px-3 py-4 text-center text-zinc-500 text-xs">
              No tasks.{' '}
              <button
                onClick={() => onNavigate('add')}
                className="text-zinc-300 underline hover:no-underline"
              >
                Add one
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Due for review table ── */}
      {dueTasks.length > 0 && (
        <div>
          <h2 className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-2">
            Due for Review
            <span className="text-zinc-500 font-mono ml-2">{dueTasks.length}</span>
          </h2>
          <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
            {dueTasks.slice(0, 8).map((task) => {
              const days = daysUntil(task.nextReview);
              const overdue = days < 0;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-zinc-800/30 transition-colors"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getTopicColor(task.topic)}`}
                  />
                  <span className="text-zinc-300 flex-1 truncate">{task.title}</span>
                  <span className="text-zinc-500 font-mono tabular-nums hidden sm:inline">
                    EF {task.easeFactor.toFixed(1)}
                  </span>
                  <span className="text-zinc-500 font-mono tabular-nums hidden sm:inline">
                    ×{task.repetitions}
                  </span>
                  {task.deadline && (
                    <span className="text-zinc-500 font-mono tabular-nums hidden md:inline text-[10px]">
                      dl {task.deadline}
                    </span>
                  )}
                  <span
                    className={`font-mono tabular-nums w-16 text-right ${overdue ? 'text-red-400' : 'text-zinc-400'}`}
                  >
                    {overdue ? `${Math.abs(days)}d late` : days === 0 ? 'today' : `in ${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
          {dueTasks.length > 8 && (
            <p className="text-[10px] text-zinc-500 text-center mt-1.5 font-mono">
              +{dueTasks.length - 8} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  accent = false,
  warn = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  const color = warn && value > 0 ? 'text-red-400' : accent ? 'text-amber-400' : 'text-zinc-100';

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 flex-1 min-w-0">
      <span className={`text-lg font-bold font-mono tabular-nums leading-none ${color}`}>
        {value}
      </span>
      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}
