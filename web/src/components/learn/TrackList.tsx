import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { BookOpen, Loader2 } from 'lucide-react';
import { getTracks } from '../../learn-api.js';
import type { Track } from '../../learn-types.js';

export default function TrackList() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTracks()
      .then(setTracks)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

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
          onClick={() => {
            setError(null);
            setLoading(true);
            getTracks()
              .then(setTracks)
              .catch((e) => setError(String(e)))
              .finally(() => setLoading(false));
          }}
          className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 hover:decoration-zinc-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <BookOpen className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">No learning tracks available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium">
        Learning Tracks
      </h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {tracks.map((track) => (
          <Link
            key={track.id}
            to={`/learn/${track.slug}`}
            className="flex items-start gap-3 px-4 py-3 border border-zinc-800 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/50 transition-colors group"
          >
            <BookOpen className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
                {track.title}
              </span>
              {track.description && (
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{track.description}</p>
              )}
              <span className="text-[10px] text-zinc-500 font-mono mt-1.5 inline-block">
                {track.moduleCount} {track.moduleCount === 1 ? 'module' : 'modules'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
