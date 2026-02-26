import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Task, Collection, Tag } from './types';
import { getTasks, getDueTasks, getStoredApiKey, setApiKey, getCollections, getTags } from './api';
import { logger } from './logger';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import ReviewSession from './components/ReviewSession';
import AddTask from './components/AddTask';
import TopicProgress from './components/TopicProgress';
import BoardView from './components/BoardView';
import ErrorBoundary from './components/ErrorBoundary';
import Spinner from './components/Spinner';
import CalendarView from './components/CalendarView';
import MockInterview from './components/MockInterview';
import CollectionSwitcher from './components/CollectionSwitcher';

type View = 'dashboard' | 'tasks' | 'board' | 'review' | 'add' | 'progress' | 'calendar' | 'mock';

const VALID_VIEWS = new Set<string>(['dashboard', 'tasks', 'board', 'review', 'add', 'progress', 'calendar', 'mock']);

function getViewFromHash(): View {
  const hash = window.location.hash.slice(1);
  return VALID_VIEWS.has(hash) ? (hash as View) : 'dashboard';
}

const PRIMARY_NAV: { view: View; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'tasks', label: 'Tasks' },
  { view: 'board', label: 'Board' },
  { view: 'review', label: 'Review' },
];

const MORE_NAV: { view: View; label: string }[] = [
  { view: 'progress', label: 'Progress' },
  { view: 'calendar', label: 'Calendar' },
  { view: 'mock', label: 'Mock Interview' },
];

const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV];

export default function App() {
  const [view, setViewState] = useState<View>(getViewFromHash);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    () => localStorage.getItem('reps_active_collection')
  );
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(!!getStoredApiKey());
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleCollectionChange = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('reps_active_collection', id);
    } else {
      localStorage.removeItem('reps_active_collection');
    }
    setActiveCollectionId(id);
  }, []);

  const handleCollectionUpdated = useCallback((updated: Collection) => {
    setCollections((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  }, []);

  const handleCollectionDeleted = useCallback((id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (activeCollectionId === id) {
      handleCollectionChange(null);
    }
  }, [activeCollectionId, handleCollectionChange]);

  const setView = useCallback((v: View) => {
    window.location.hash = v === 'dashboard' ? '' : v;
    setViewState(v);
  }, []);

  useEffect(() => {
    function onHashChange() {
      setViewState(getViewFromHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!moreOpen && !mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreOpen && moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen, mobileMenuOpen]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTasks, due] = await Promise.all([getTasks(), getDueTasks()]);
      setTasks(allTasks);
      setDueTasks(due);
    } catch (err) {
      logger.error('Failed to fetch data', { error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Background refresh: re-fetches without loading spinner
  const refreshQuietly = useCallback(async () => {
    try {
      const [allTasks, due] = await Promise.all([getTasks(), getDueTasks()]);
      setTasks(allTasks);
      setDueTasks(due);
    } catch (err) {
      logger.error('Background refresh failed', { error: String(err) });
    }
  }, []);

  // Optimistic task update: patches local state immediately, syncs with server in background
  const optimisticUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
    setDueTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const cols = await getCollections();
      setCollections(cols);
      // Validate stored collection still exists
      const stored = localStorage.getItem('reps_active_collection');
      if (stored && !cols.some((c) => c.id === stored)) {
        handleCollectionChange(null);
      }
    } catch {
      // Collections are optional — silently fail
    }
  }, [handleCollectionChange]);

  const fetchTags = useCallback(async () => {
    try {
      const t = await getTags();
      setTags(t);
    } catch {
      // Tags are optional — silently fail
    }
  }, []);

  useEffect(() => {
    if (hasApiKey) {
      fetchData();
      fetchCollections();
      fetchTags();
    }
  }, [hasApiKey, fetchData, fetchCollections, fetchTags]);

  function handleSetApiKey() {
    if (!apiKeyInput.trim()) return;
    setApiKey(apiKeyInput.trim());
    setApiKeyInput('');
    setHasApiKey(true);
  }

  function handleTagCreated(tag: Tag) {
    setTags((prev) => [...prev, tag]);
  }

  // Filter tasks by active collection if set
  const filteredTasks = activeCollectionId
    ? tasks.filter((t) => t.collectionId === activeCollectionId)
    : tasks;
  const filteredDueTasks = activeCollectionId
    ? dueTasks.filter((t) => t.collectionId === activeCollectionId)
    : dueTasks;

  const activeStatuses = useMemo(() => {
    if (!activeCollectionId) return undefined;
    const col = collections.find(c => c.id === activeCollectionId);
    return col?.statuses;
  }, [activeCollectionId, collections]);

  const activeStatusOptions = useMemo(() => {
    if (!activeStatuses || activeStatuses.length === 0) return undefined;
    return activeStatuses.map(s => ({ value: s.name, label: s.name.charAt(0).toUpperCase() + s.name.slice(1) }));
  }, [activeStatuses]);

  const isMoreView = MORE_NAV.some((n) => n.view === view);

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <form
          className="w-full max-w-sm p-8"
          onSubmit={(e) => { e.preventDefault(); handleSetApiKey(); }}
          data-1p-ignore
        >
          <h1 className="text-4xl font-bold tracking-tight mb-2">reps</h1>
          <p className="text-zinc-400 mb-8">Enter your API key to connect.</p>
          <input
            type="text"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="API key"
            autoComplete="off"
            data-1p-ignore
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 mb-4 [-webkit-text-security:disc]"
          />
          <button
            type="submit"
            className="w-full py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Connect
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setView('dashboard')}
            className="text-2xl font-bold tracking-tight hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            reps
          </button>

          <CollectionSwitcher
            collections={collections}
            activeId={activeCollectionId}
            onChange={handleCollectionChange}
            onCollectionCreated={(col) => setCollections((prev) => [...prev, col])}
            onCollectionUpdated={handleCollectionUpdated}
            onCollectionDeleted={handleCollectionDeleted}
          />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {PRIMARY_NAV.map(({ view: v, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  view === v
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {label}
              </button>
            ))}

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  isMoreView
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                More
                <svg className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {moreOpen && (
                <div className="absolute top-full right-0 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-50">
                  {MORE_NAV.map(({ view: v, label }) => (
                    <button
                      key={v}
                      onClick={() => { setView(v); setMoreOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        view === v
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Desktop add + disconnect */}
          <button
            onClick={() => setView('add')}
            className={`hidden md:flex flex-shrink-0 w-8 h-8 rounded-lg items-center justify-center text-lg font-light transition-colors ${
              view === 'add'
                ? 'bg-zinc-100 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
            title="Add task"
          >
            +
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('reps_api_key');
              setHasApiKey(false);
            }}
            className="hidden md:block text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            Disconnect
          </button>

          {/* Mobile hamburger */}
          <div ref={mobileMenuRef} className="md:hidden ml-auto relative">
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {mobileMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-50">
                {ALL_NAV.map(({ view: v, label }) => (
                  <button
                    key={v}
                    onClick={() => { setView(v); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      view === v
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="border-t border-zinc-800 mt-1 pt-1">
                  <button
                    onClick={() => { setView('add'); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      view === 'add'
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                    }`}
                  >
                    + Add Task
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('reps_api_key');
                      setHasApiKey(false);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
            <button onClick={fetchData} className="ml-4 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {loading && !error ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" label="Loading..." />
          </div>
        ) : (
          <ErrorBoundary key={view}>
            {view === 'dashboard' && (
              <Dashboard
                tasks={filteredTasks}
                dueTasks={filteredDueTasks}
                onStartReview={() => setView('review')}
                onNavigate={setView}
                activeCollectionId={activeCollectionId}
              />
            )}
            {view === 'tasks' && (
              <TaskList
                tasks={filteredTasks}
                onRefresh={fetchData}
                availableTags={tags}
                collections={collections}
                onTagCreated={handleTagCreated}
                statusOptions={activeStatusOptions}
              />
            )}
            {view === 'board' && (
              <BoardView
                tasks={filteredTasks}
                onRefresh={fetchData}
                onOptimisticUpdate={optimisticUpdateTask}
                onBackgroundRefresh={refreshQuietly}
                collections={collections}
                availableTags={tags}
                onTagCreated={handleTagCreated}
                collectionStatuses={activeStatuses}
                statusOptions={activeStatusOptions}
              />
            )}
            {view === 'review' && (
              <ReviewSession dueTasks={filteredDueTasks} onComplete={fetchData} />
            )}
            {view === 'add' && (
              <AddTask
                onCreated={() => {
                  fetchData();
                  setView('tasks');
                }}
                availableTags={tags}
                onTagCreated={handleTagCreated}
                activeCollectionId={activeCollectionId}
              />
            )}
            {view === 'progress' && (
              <TopicProgress
                tasks={filteredTasks}
                activeCollectionId={activeCollectionId}
              />
            )}
            {view === 'calendar' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
                <CalendarView tasks={filteredTasks} />
              </div>
            )}
            {view === 'mock' && <MockInterview />}
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
