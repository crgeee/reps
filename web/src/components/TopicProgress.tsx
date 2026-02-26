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
  if (ef >= 2.0) return { label: 'Mod', color: 'text-amber-400' };
  if (ef >= 1.5) return { label: 'Weak', color: 'text-orange-400' };
  return { label: 'Low', color: 'text-red-400' };
}

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
      active.length > 0 ? active.reduce((sum, t) => sum + t.easeFactor, 0) / active.length : 0;
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Progress</h1>
        <span className="text-[10px] text-zinc-600 font-mono">
          {topicStats.reduce((s, t) => s + t.total, 0)} tasks across {topicStats.length} topics
        </span>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="flex items-stretch border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/60 divide-x divide-zinc-800">
          <div className="flex items-center gap-2 px-4 py-2.5 flex-1">
            <span className="text-lg font-bold font-mono tabular-nums text-zinc-100">
              {stats.totalReviews}
            </span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Reviews</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 flex-1">
            <span className="text-lg font-bold font-mono tabular-nums text-zinc-100">
              {stats.reviewsLast30Days}
            </span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">30d</span>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div>
        <h2 className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-2">
          Activity
        </h2>
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 overflow-x-auto">
          <Heatmap data={heatmapData} days={365} />
        </div>
      </div>

      {/* Reviews by topic bar chart */}
      {stats && Object.keys(reviewsByTopicData).length > 0 && (
        <div>
          <h2 className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-2">
            Reviews by Topic
          </h2>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
            <BarChart data={reviewsByTopicData} colors={reviewsByTopicColors} />
          </div>
        </div>
      )}

      {topicStats.length === 0 && (
        <p className="text-zinc-600 py-8 text-center text-xs">No tasks yet.</p>
      )}

      {/* Per-topic table */}
      {topicStats.length > 0 && (
        <div>
          <h2 className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-2">
            Breakdown
          </h2>
          <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 bg-zinc-900/40">
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-zinc-600 uppercase tracking-wider font-medium bg-zinc-900/80">
              <span className="w-28">Topic</span>
              <span className="flex-1">Progress</span>
              <span className="w-12 text-right font-mono">Done</span>
              <span className="w-12 text-right font-mono hidden sm:inline">Due</span>
              <span className="w-14 text-right font-mono hidden sm:inline">Avg EF</span>
              <span className="w-14 text-right hidden md:inline">Conf</span>
              <span className="w-20 text-right font-mono hidden md:inline">Reviewed</span>
            </div>
            {topicStats.map((stat) => {
              const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
              const confidence =
                stat.avgEaseFactor > 0 ? getConfidenceLevel(stat.avgEaseFactor) : null;

              return (
                <div
                  key={stat.topic}
                  className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="w-28 flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TOPIC_COLORS[stat.topic]}`}
                    />
                    <span className="text-zinc-300 truncate">{TOPIC_LABELS[stat.topic]}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${TOPIC_COLORS[stat.topic]} opacity-80`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-zinc-600 font-mono tabular-nums w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                  <span className="w-12 text-right font-mono tabular-nums text-zinc-400">
                    {stat.completed}/{stat.total}
                  </span>
                  <span
                    className={`w-12 text-right font-mono tabular-nums hidden sm:inline ${stat.dueCount > 0 ? 'text-amber-400' : 'text-zinc-600'}`}
                  >
                    {stat.dueCount}
                  </span>
                  <span className="w-14 text-right font-mono tabular-nums text-zinc-500 hidden sm:inline">
                    {stat.avgEaseFactor > 0 ? stat.avgEaseFactor.toFixed(2) : '--'}
                  </span>
                  <span
                    className={`w-14 text-right hidden md:inline text-[10px] font-medium ${confidence?.color ?? 'text-zinc-700'}`}
                  >
                    {confidence?.label ?? '--'}
                  </span>
                  <span className="w-20 text-right font-mono tabular-nums text-zinc-600 hidden md:inline">
                    {stat.lastReviewed ?? '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      {topicStats.length > 0 && (
        <p className="text-[10px] text-zinc-700 font-mono">
          EF = Ease Factor (SM-2) · Strong ≥2.5 · Mod 2.0–2.5 · Weak 1.5–2.0 · Low &lt;1.5
        </p>
      )}
    </div>
  );
}
