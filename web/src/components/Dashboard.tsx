import { useState, useEffect } from 'react';
import type { Task, Topic, Streaks } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { getStreaks, getHeatmap } from '../api';
import StreakBadge from './StreakBadge';
import Heatmap from './Heatmap';

type View = 'dashboard' | 'tasks' | 'board' | 'review' | 'add' | 'progress' | 'calendar' | 'mock';

interface DashboardProps {
  tasks: Task[];
  dueTasks: Task[];
  onStartReview: () => void;
  onNavigate: (view: View) => void;
  activeCollectionId?: string | null;
}

function isOverdue(task: Task): boolean {
  return new Date(task.nextReview) < new Date(new Date().toISOString().split('T')[0]!);
}

export default function Dashboard({
  tasks,
  dueTasks,
  onStartReview,
  onNavigate,
  activeCollectionId,
}: DashboardProps) {
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});

  useEffect(() => {
    getStreaks(activeCollectionId ?? undefined)
      .then(setStreaks)
      .catch(() => null);
    getHeatmap(activeCollectionId ?? undefined)
      .then(setHeatmapData)
      .catch(() => null);
  }, [activeCollectionId]);

  const overdueTasks = dueTasks.filter(isOverdue);
  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  const topicStats = TOPICS.map((topic) => {
    const topicTasks = tasks.filter((t) => t.topic === topic);
    const completed = topicTasks.filter((t) => t.completed).length;
    const total = topicTasks.length;
    return { topic, completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }).filter((s) => s.total > 0);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Dashboard</h1>
        <p className="text-zinc-400">
          {activeTasks.length} active tasks, {completedTasks.length} completed
        </p>
      </div>

      {/* Overdue alert */}
      {overdueTasks.length > 0 && (
        <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-lg">
          <p className="text-red-300 font-medium">
            {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'review' : 'reviews'}
          </p>
          <p className="text-red-400/80 text-sm mt-1">
            {overdueTasks.map((t) => t.title).join(', ')}
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Due Today" value={dueTasks.length} accent={dueTasks.length > 0} />
        <StatCard label="Overdue" value={overdueTasks.length} accent={overdueTasks.length > 0} />
        <StatCard label="Active" value={activeTasks.length} />
        <StatCard label="Completed" value={completedTasks.length} />
        {streaks && (
          <div className="col-span-2 sm:col-span-1">
            <StreakBadge current={streaks.currentStreak} longest={streaks.longestStreak} />
          </div>
        )}
      </div>

      {/* Start Review CTA */}
      {dueTasks.length > 0 && (
        <button
          onClick={onStartReview}
          className="w-full py-4 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-lg"
        >
          Start Review ({dueTasks.length} {dueTasks.length === 1 ? 'task' : 'tasks'} due)
        </button>
      )}

      {/* Topic progress */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Progress by Topic</h2>
          <button
            onClick={() => onNavigate('progress')}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            View details
          </button>
        </div>
        <div className="space-y-3">
          {topicStats.map(({ topic, completed, total, pct }) => (
            <TopicBar
              key={topic}
              topic={topic}
              completed={completed}
              total={total}
              pct={pct}
            />
          ))}
          {topicStats.length === 0 && (
            <p className="text-zinc-500 text-sm">
              No tasks yet.{' '}
              <button
                onClick={() => onNavigate('add')}
                className="text-zinc-300 underline hover:no-underline"
              >
                Add your first task
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Review Activity</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
          <Heatmap data={heatmapData} days={365} />
        </div>
      </div>

      {/* Upcoming reviews */}
      {dueTasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Due for Review</h2>
          <div className="space-y-2">
            {dueTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg"
              >
                <div>
                  <span className="font-medium">{task.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {TOPIC_LABELS[task.topic]}
                  </span>
                </div>
                <span
                  className={`text-xs ${isOverdue(task) ? 'text-red-400' : 'text-zinc-500'}`}
                >
                  {task.nextReview}
                </span>
              </div>
            ))}
            {dueTasks.length > 5 && (
              <p className="text-zinc-500 text-sm text-center">
                +{dueTasks.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="p-4 bg-zinc-900 rounded-lg">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-amber-400' : 'text-zinc-100'}`}>
        {value}
      </p>
    </div>
  );
}

function TopicBar({
  topic,
  completed,
  total,
  pct,
}: {
  topic: Topic;
  completed: number;
  total: number;
  pct: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-zinc-300">{TOPIC_LABELS[topic]}</span>
        <span className="text-zinc-500">
          {completed}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${TOPIC_COLORS[topic]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
