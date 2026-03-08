import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Lock,
  PlayCircle,
  CheckCircle2,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { getTrack, startModule } from '../../learn-api.js';
import type { TrackDetail as TrackDetailType, ModuleWithProgress } from '../../learn-types.js';

function moduleStatus(mod: ModuleWithProgress): 'locked' | 'active' | 'completed' {
  if (!mod.progress) return 'locked';
  if (mod.progress.status === 'completed') return 'completed';
  return 'active';
}

export default function TrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [track, setTrack] = useState<TrackDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const fetchTrack = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    getTrack(slug)
      .then(setTrack)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetchTrack();
  }, [fetchTrack]);

  async function handleStart(moduleId: string) {
    setStartingId(moduleId);
    try {
      await startModule(moduleId);
      fetchTrack();
    } catch (e) {
      setError(String(e));
    } finally {
      setStartingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchTrack}
          className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 hover:decoration-zinc-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!track) return null;

  const completedCount = track.modules.filter(
    (m) => moduleStatus(m) === 'completed',
  ).length;
  const totalCount = track.modules.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-5">
      <Link
        to="/learn"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to tracks
      </Link>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-zinc-100">{track.title}</h1>
        {track.description && <p className="text-sm text-zinc-400">{track.description}</p>}

        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
            {completedCount}/{totalCount} modules
          </span>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="px-4 py-12 text-center">
          <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No modules in this track yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {track.modules
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((mod) => {
              const status = moduleStatus(mod);
              return (
                <ModuleCard
                  key={mod.id}
                  mod={mod}
                  status={status}
                  starting={startingId === mod.id}
                  onStart={() => handleStart(mod.id)}
                  onNavigate={() => navigate(`/learn/${track.slug}/${mod.slug}/exercise`)}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  mod,
  status,
  starting,
  onStart,
  onNavigate,
}: {
  mod: ModuleWithProgress;
  status: 'locked' | 'active' | 'completed';
  starting: boolean;
  onStart: () => void;
  onNavigate: () => void;
}) {
  const isLocked = status === 'locked';
  const isActive = status === 'active';
  const isCompleted = status === 'completed';

  const borderColor = isCompleted
    ? 'border-green-900/50'
    : isActive
      ? 'border-blue-900/50'
      : 'border-zinc-800';

  const bgColor = isCompleted
    ? 'bg-green-950/20'
    : isActive
      ? 'bg-blue-950/20'
      : 'bg-zinc-900/40';

  function handleClick() {
    if (starting) return;
    if (isLocked) {
      onStart();
    } else {
      onNavigate();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={starting}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 border rounded-lg transition-colors group ${borderColor} ${bgColor} ${
        isLocked
          ? 'opacity-60 hover:opacity-80'
          : 'hover:bg-zinc-800/50 cursor-pointer'
      } disabled:cursor-wait`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {starting ? (
          <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        ) : isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : isActive ? (
          <PlayCircle className="w-5 h-5 text-blue-400" />
        ) : (
          <Lock className="w-4 h-4 text-zinc-600 mt-0.5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">{mod.sortOrder}.</span>
          <span
            className={`text-sm font-medium ${
              isLocked ? 'text-zinc-500' : 'text-zinc-200 group-hover:text-zinc-100'
            } transition-colors`}
          >
            {mod.title}
          </span>
        </div>

        {mod.description && (
          <p className={`text-xs mt-1 line-clamp-2 ${isLocked ? 'text-zinc-600' : 'text-zinc-500'}`}>
            {mod.description}
          </p>
        )}

        {mod.concepts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {mod.concepts.map((concept) => (
              <span
                key={concept}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isLocked
                    ? 'bg-zinc-800/50 text-zinc-600'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {concept}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
