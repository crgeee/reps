import type { Task, Topic } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';

interface TopicProgressProps {
  tasks: Task[];
}

interface TopicStat {
  topic: Topic;
  total: number;
  completed: number;
  active: number;
  avgEaseFactor: number;
  lastReviewed: string | null;
  dueCount: number;
}

function getConfidenceLevel(ef: number): { label: string; color: string } {
  if (ef >= 2.5) return { label: 'Strong', color: 'text-green-400' };
  if (ef >= 2.0) return { label: 'Moderate', color: 'text-amber-400' };
  if (ef >= 1.5) return { label: 'Weak', color: 'text-orange-400' };
  return { label: 'Struggling', color: 'text-red-400' };
}

export default function TopicProgress({ tasks }: TopicProgressProps) {
  const today = new Date().toISOString().split('T')[0]!;

  const stats: TopicStat[] = TOPICS.map((topic) => {
    const topicTasks = tasks.filter((t) => t.topic === topic);
    const active = topicTasks.filter((t) => !t.completed);
    const completed = topicTasks.filter((t) => t.completed);
    const reviewed = topicTasks.filter((t) => t.lastReviewed).sort((a, b) =>
      (b.lastReviewed ?? '').localeCompare(a.lastReviewed ?? '')
    );
    const avgEF =
      active.length > 0
        ? active.reduce((sum, t) => sum + t.easeFactor, 0) / active.length
        : 0;
    const dueCount = active.filter((t) => t.nextReview <= today).length;

    return {
      topic,
      total: topicTasks.length,
      completed: completed.length,
      active: active.length,
      avgEaseFactor: avgEF,
      lastReviewed: reviewed[0]?.lastReviewed ?? null,
      dueCount,
    };
  }).filter((s) => s.total > 0);

  const maxTotal = Math.max(...stats.map((s) => s.total), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Progress</h1>
        <p className="text-zinc-400">Performance breakdown by topic</p>
      </div>

      {stats.length === 0 && (
        <p className="text-zinc-500 py-12 text-center">No tasks yet. Add some to track progress.</p>
      )}

      {/* Bar chart */}
      <div className="space-y-4">
        {stats.map((stat) => {
          const barWidth = (stat.total / maxTotal) * 100;
          const completedWidth = stat.total > 0 ? (stat.completed / stat.total) * barWidth : 0;
          const confidence = stat.avgEaseFactor > 0 ? getConfidenceLevel(stat.avgEaseFactor) : null;

          return (
            <div key={stat.topic} className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${TOPIC_COLORS[stat.topic]}`} />
                  <h3 className="font-semibold">{TOPIC_LABELS[stat.topic]}</h3>
                </div>
                {confidence && (
                  <span className={`text-sm font-medium ${confidence.color}`}>
                    {confidence.label}
                  </span>
                )}
              </div>

              {/* Stacked bar */}
              <div className="h-6 bg-zinc-800 rounded-full overflow-hidden mb-3">
                <div className="h-full flex">
                  <div
                    className={`${TOPIC_COLORS[stat.topic]} opacity-100 transition-all`}
                    style={{ width: `${completedWidth}%` }}
                  />
                  <div
                    className={`${TOPIC_COLORS[stat.topic]} opacity-30 transition-all`}
                    style={{ width: `${barWidth - completedWidth}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Total</p>
                  <p className="font-medium">{stat.total}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Completed</p>
                  <p className="font-medium text-green-400">{stat.completed}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Due</p>
                  <p className={`font-medium ${stat.dueCount > 0 ? 'text-amber-400' : ''}`}>
                    {stat.dueCount}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Avg EF</p>
                  <p className="font-medium">
                    {stat.avgEaseFactor > 0 ? stat.avgEaseFactor.toFixed(2) : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Last Reviewed</p>
                  <p className="font-medium">{stat.lastReviewed ?? '--'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {stats.length > 0 && (
        <div className="text-xs text-zinc-600 space-y-1">
          <p>EF = Ease Factor (SM-2). Higher means easier recall. Range: 1.3 - 2.5+</p>
          <p>
            Confidence: Strong (EF 2.5+) | Moderate (2.0-2.5) | Weak (1.5-2.0) | Struggling
            (&lt;1.5)
          </p>
        </div>
      )}
    </div>
  );
}
