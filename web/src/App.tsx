import { useState, useEffect, useCallback } from 'react';
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

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'tasks', label: 'Tasks' },
  { view: 'board', label: 'Board' },
  { view: 'review', label: 'Review' },
  { view: 'add', label: 'Add Task' },
  { view: 'progress', label: 'Progress' },
  { view: 'calendar', label: 'Calendar' },
  { view: 'mock', label: 'Mock' },
];

export default function App() {
  const [view, setViewState] = useState<View>(getViewFromHash);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(!!getStoredApiKey());

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
      // Set first collection as active if none selected yet
      if (activeCollectionId === null && cols.length > 0) {
        setActiveCollectionId(null); // Keep "All" as default
      }
    } catch {
      // Collections are optional — silently fail
    }
  }, [activeCollectionId]);

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

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="w-full max-w-sm p-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">reps</h1>
          <p className="text-zinc-400 mb-8">Enter your API key to connect.</p>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetApiKey()}
            placeholder="API key"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 mb-4"
          />
          <button
            onClick={handleSetApiKey}
            className="w-full py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setView('dashboard')}
            className="text-2xl font-bold tracking-tight hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            reps
          </button>

          <CollectionSwitcher
            collections={collections}
            activeId={activeCollectionId}
            onChange={setActiveCollectionId}
            onCollectionCreated={(col) => setCollections((prev) => [...prev, col])}
          />

          <nav className="flex gap-1 overflow-x-auto flex-1 justify-center">
            {NAV_ITEMS.map(({ view: v, label }) => (
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
          </nav>

          <button
            onClick={() => {
              localStorage.removeItem('reps_api_key');
              setHasApiKey(false);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
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
              />
            )}
            {view === 'board' && (
              <BoardView
                tasks={filteredTasks}
                onRefresh={fetchData}
                onOptimisticUpdate={optimisticUpdateTask}
                onBackgroundRefresh={refreshQuietly}
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
