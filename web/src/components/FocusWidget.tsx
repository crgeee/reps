import { useState, useEffect, useRef } from 'react';
import { Timer, X, ChevronDown, Music, ExternalLink } from 'lucide-react';
import FocusTimer from './FocusTimer';

const PLAYLISTS = [
  { id: 'jfKfPfyJRdk', label: 'Lofi Hip Hop', description: 'lofi girl 24/7' },
  { id: 'DWcJFNfaw9c', label: 'Classical Focus', description: 'classical music' },
  { id: '5yx6BWlEVcY', label: 'Ambient', description: 'ambient soundscapes' },
];

const EXTERNAL_LINKS = [
  { label: 'Brain.fm', url: 'https://www.brain.fm', description: 'AI focus music (subscription)' },
];

function getStoredState<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export default function FocusWidget() {
  const [expanded, setExpanded] = useState(() => getStoredState('reps_focus_expanded', false));
  const [activePlaylist, setActivePlaylist] = useState<string | null>(() =>
    getStoredState('reps_focus_playlist', null),
  );
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('reps_focus_expanded', JSON.stringify(expanded));
  }, [expanded]);

  useEffect(() => {
    localStorage.setItem('reps_focus_playlist', JSON.stringify(activePlaylist));
  }, [activePlaylist]);

  // Poll the timer display from the DOM when collapsed
  useEffect(() => {
    if (expanded) {
      setTimerDisplay(null);
      return;
    }
    const interval = setInterval(() => {
      const el = document.querySelector('[data-focus-timer-display]');
      const text = el?.textContent ?? null;
      setTimerDisplay((prev) => (prev === text ? prev : text));
    }, 500);
    return () => clearInterval(interval);
  }, [expanded]);

  // Close playlist dropdown on outside click
  useEffect(() => {
    if (!playlistOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPlaylistOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [playlistOpen]);

  const activeLabel = PLAYLISTS.find((p) => p.id === activePlaylist)?.label;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label={timerDisplay ? `Focus timer: ${timerDisplay} remaining` : 'Open focus widget'}
        className="anim-scale-in fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-full shadow-lg hover:bg-zinc-800 hover:border-zinc-600 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 group"
      >
        <Timer className="w-4 h-4 text-amber-400" />
        {timerDisplay ? (
          <span className="text-sm font-mono text-zinc-100 tabular-nums">{timerDisplay}</span>
        ) : (
          <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
            Focus
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="anim-slide-up fixed bottom-4 right-4 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-zinc-200">Focus</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          aria-label="Collapse focus widget"
          className="p-1 text-zinc-500 hover:text-zinc-300 hover:rotate-90 transition-all duration-200 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Timer */}
      <div className="p-4">
        <FocusTimer />
      </div>

      {/* Music section */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Music className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Focus Music
          </span>
        </div>

        {/* Playlist selector */}
        <div ref={dropdownRef} className="relative mb-2">
          <button
            onClick={() => setPlaylistOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <span>{activeLabel ?? 'Select playlist...'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${playlistOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {playlistOpen && (
            <div className="anim-slide-up-dropdown absolute bottom-full left-0 right-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-10">
              {PLAYLISTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePlaylist(p.id);
                    setPlaylistOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    activePlaylist === p.id
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50'
                  }`}
                >
                  <div>{p.label}</div>
                  <div className="text-xs text-zinc-500">{p.description}</div>
                </button>
              ))}
              {activePlaylist && (
                <>
                  <div className="border-t border-zinc-700 my-1" />
                  <button
                    onClick={() => {
                      setActivePlaylist(null);
                      setPlaylistOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Stop music
                  </button>
                </>
              )}
              <div className="border-t border-zinc-700 my-1" />
              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 transition-colors"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="w-3 h-3 text-zinc-600" />
                  <span className="text-xs text-zinc-600 ml-auto">{link.description}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* YouTube embed */}
        {activePlaylist && (
          <div className="anim-expand-down rounded-lg overflow-hidden bg-black">
            <iframe
              width="100%"
              height="158"
              src={`https://www.youtube.com/embed/${activePlaylist}?autoplay=1&rel=0`}
              title="Focus music"
              allow="autoplay; encrypted-media"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              loading="lazy"
              allowFullScreen={false}
              className="block"
            />
          </div>
        )}
      </div>
    </div>
  );
}
