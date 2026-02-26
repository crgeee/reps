import { useState, useEffect } from 'react';
import type { Task, Topic, StatsOverview } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { getStatsOverview, getHeatmap } from '../api';
import Heatmap from './Heatmap';
import BarChart from './BarChart';

interface TopicProgressProps {
  tasks: Task[];
  activeCollectionId?: string | null;
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

// Map topic to Tailwind bar color for BarChart (using bg- classes)
const TOPIC_BAR_COLORS: Record<Topic, string> = {
  coding: 'bg-blue-500',
  'system-design': 'bg-purple-500',
  behavioral: 'bg-green-500',
  papers: 'bg-amber-500',
  custom: 'bg-slate-500',
};

export default function TopicProgress({ tasks, activeCollectionId }: TopicProgressProps) {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});

  useEffect(() => {
    getStatsOverview(activeCollectionId ?? undefined)
      .then(setStats)
      .catch(() => null);
    getHeatmap(activeCollectionId ?? undefined)
      .then(setHeatmapData)
      .catch(() => null);
  }, [activeCollectionId]);

  const today = new Date().toISOString().split('T')[0]!;

  const topicStats: TopicStat[] = TOPICS.map((topic) => {
    const topicTasks = tasks.filter((t) => t.topic === topic);
    const active = topicTasks.filter((t) => !t.completed);
    const completed = topicTasks.filter((t) => t.completed);
    const reviewed = topicTasks
      .filter((t) => t.lastReviewed)
      .sort((a, b) => (b.lastReviewed ?? '').localeCompare(a.lastReviewed ?? ''));
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

  const maxTotal = Math.max(...topicStats.map((s) => s.total), 1);

  // Build BarChart data from stats overview (reviews by topic)
  const reviewsByTopicData: Record<string, number> = {};
  const reviewsByTopicColors: Record<string, string> = {};
  if (stats?.reviewsByTopic) {
    for (const [topic, count] of Object.entries(stats.reviewsByTopic)) {
      const label = TOPIC_LABELS[topic as Topic] ?? topic;
      reviewsByTopicData[label] = count;
      reviewsByTopicColors[label] = TOPIC_BAR_COLORS[topic as Topic] ?? 'bg-zinc-500';
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Progress</h1>
        <p className="text-zinc-400">Performance breakdown by topic</p>
      </div>

      {/* Stats summary from API */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-lg p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 font-medium">Total Reviews</p>
            <p className="text-3xl font-bold text-zinc-100 font-mono tabular-nums">{stats.totalReviews}</p>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-lg p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 font-medium">Last 30 Days</p>
            <p className="text-3xl font-bold text-zinc-100 font-mono tabular-nums">{stats.reviewsLast30Days}</p>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Review Activity</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
          <Heatmap data={heatmapData} days={365} />
        </div>
      </div>

      {/* Reviews by topic bar chart */}
      {stats && Object.keys(reviewsByTopicData).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Reviews by Topic</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <BarChart data={reviewsByTopicData} colors={reviewsByTopicColors} />
          </div>
        </div>
      )}

      {topicStats.length === 0 && (
        <p className="text-zinc-500 py-12 text-center">No tasks yet. Add some to track progress.</p>
      )}

      {/* Per-topic breakdown */}
      <div className="space-y-4">
        {topicStats.map((stat) => {
          const barWidth = (stat.total / maxTotal) * 100;
          const completedWidth = stat.total > 0 ? (stat.completed / stat.total) * barWidth : 0;
          const confidence = stat.avgEaseFactor > 0 ? getConfidenceLevel(stat.avgEaseFactor) : null;

          return (
            <div key={stat.topic} className="bg-zinc-900/80 rounded-lg border border-zinc-800/60 p-5 transition-all duration-200">
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
                    className={`${TOPIC_COLORS[stat.topic]} opacity-100 transition-all duration-500`}
                    style={{ width: `${completedWidth}%` }}
                  />
                  <div
                    className={`${TOPIC_COLORS[stat.topic]} opacity-30 transition-all duration-500`}
                    style={{ width: `${barWidth - completedWidth}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Total</p>
                  <p className="font-bold font-mono tabular-nums">{stat.total}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Completed</p>
                  <p className="font-bold font-mono tabular-nums text-green-400">{stat.completed}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Due</p>
                  <p className={`font-bold font-mono tabular-nums ${stat.dueCount > 0 ? 'text-amber-400' : ''}`}>
                    {stat.dueCount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Avg EF</p>
                  <p className="font-bold font-mono tabular-nums">
                    {stat.avgEaseFactor > 0 ? stat.avgEaseFactor.toFixed(2) : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Last Reviewed</p>
                  <p className="font-bold font-mono tabular-nums">{stat.lastReviewed ?? '--'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {topicStats.length > 0 && (
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
