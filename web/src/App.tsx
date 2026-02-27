import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Task, Collection, Tag, User } from './types';
import { formatStatusLabel } from './types';
import { getTasks, getDueTasks, getCollections, getTags } from './api';
import { useAuth } from './hooks/useAuth';
import { logger } from './logger';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import ReviewSession from './components/ReviewSession';
import AddTask from './components/AddTask';
import TopicProgress from './components/TopicProgress';
import ErrorBoundary from './components/ErrorBoundary';
import Spinner from './components/Spinner';
import CalendarView from './components/CalendarView';
import ExportView from './components/ExportView';
import CollectionSwitcher from './components/CollectionSwitcher';
import FocusWidget from './components/FocusWidget';
import LoginPage from './components/LoginPage';
import Settings from './components/Settings';
import DeviceApproval from './components/DeviceApproval';
import Footer from './components/Footer';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import { Home, ListTodo, Plus, GraduationCap, BarChart3 } from 'lucide-react';

type View =
  | 'dashboard'
  | 'tasks'
  | 'review'
  | 'add'
  | 'progress'
  | 'calendar'
  | 'export'
  | 'settings'
  | 'device-approve'
  | 'privacy'
  | 'terms';

const VALID_VIEWS = new Set<string>([
  'dashboard',
  'tasks',
  'review',
  'add',
  'progress',
  'calendar',
  'export',
  'settings',
  'device-approve',
  'privacy',
  'terms',
  // Legacy routes redirect to consolidated views
  'board',
  'mock',
]);

const LEGACY_REDIRECTS: Record<string, View> = {
  board: 'tasks',
  mock: 'review',
};

const BOTTOM_NAV_ITEMS: { view: View; label: string; Icon: typeof Home }[] = [
  { view: 'dashboard', label: 'Home', Icon: Home },
  { view: 'tasks', label: 'Tasks', Icon: ListTodo },
  { view: 'add', label: 'Add', Icon: Plus },
  { view: 'review', label: 'Review', Icon: GraduationCap },
  { view: 'progress', label: 'Progress', Icon: BarChart3 },
];

function getViewFromHash(): View {
  const hash = window.location.hash.slice(1);
  if (!VALID_VIEWS.has(hash)) return 'dashboard';
  if (hash in LEGACY_REDIRECTS) return LEGACY_REDIRECTS[hash]!;
  return hash as View;
}

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'tasks', label: 'Tasks' },
  { view: 'review', label: 'Review' },
  { view: 'progress', label: 'Progress' },
  { view: 'calendar', label: 'Calendar' },
];

export default function App() {
  const { user, loading: authLoading, isAuthenticated, logout, refresh: refreshAuth } = useAuth();
  const [view, setViewState] = useState<View>(getViewFromHash);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(() =>
    localStorage.getItem('reps_active_collection'),
  );
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  const handleCollectionDeleted = useCallback(
    (id: string) => {
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (activeCollectionId === id) {
        handleCollectionChange(null);
      }
    },
    [activeCollectionId, handleCollectionChange],
  );

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

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileMenuOpen]);

  const applyTaskData = useCallback((allTasks: Task[], due: Task[]) => {
    setTasks(allTasks);
    setDueTasks(due);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTasks, due] = await Promise.all([getTasks(), getDueTasks()]);
      applyTaskData(allTasks, due);
    } catch (err) {
      logger.error('Failed to fetch data', { error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [applyTaskData]);

  // Background refresh: re-fetches without loading spinner
  const refreshQuietly = useCallback(async () => {
    try {
      const [allTasks, due] = await Promise.all([getTasks(), getDueTasks()]);
      applyTaskData(allTasks, due);
    } catch (err) {
      logger.error('Background refresh failed', { error: String(err) });
    }
  }, [applyTaskData]);

  // Optimistic task update: patches local state immediately, syncs with server in background
  const optimisticUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    setDueTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
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
    if (isAuthenticated) {
      fetchData();
      fetchCollections();
      fetchTags();
    }
  }, [isAuthenticated, fetchData, fetchCollections, fetchTags]);

  function handleUserUpdate(_updated: User) {
    refreshAuth();
  }

  function handleTagCreated(tag: Tag) {
    setTags((prev) => [...prev, tag]);
  }

  // Filter tasks by active collection if set
  const filteredTasks = useMemo(
    () => (activeCollectionId ? tasks.filter((t) => t.collectionId === activeCollectionId) : tasks),
    [tasks, activeCollectionId],
  );
  const filteredDueTasks = useMemo(
    () =>
      activeCollectionId ? dueTasks.filter((t) => t.collectionId === activeCollectionId) : dueTasks,
    [dueTasks, activeCollectionId],
  );

  const activeStatuses = useMemo(() => {
    if (!activeCollectionId) return undefined;
    const col = collections.find((c) => c.id === activeCollectionId);
    return col?.statuses;
  }, [activeCollectionId, collections]);

  const activeStatusOptions = useMemo(() => {
    if (!activeStatuses || activeStatuses.length === 0) return undefined;
    return activeStatuses.map((s) => ({ value: s.name, label: formatStatusLabel(s.name) }));
  }, [activeStatuses]);

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-zinc-950 focus:rounded-lg focus:font-semibold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-1.5 flex-shrink-0 transition-opacity hover:opacity-80"
          >
            <svg className="w-7 h-7" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="6" fill="#09090b" />
              <text
                x="16"
                y="23"
                fontFamily="system-ui"
                fontWeight="800"
                fontSize="22"
                fill="#f59e0b"
                textAnchor="middle"
              >
                r
              </text>
              <path
                d="M24 8 C26 10, 26 13, 24 15"
                stroke="#f59e0b"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                opacity="0.6"
              />
              <path
                d="M26 7 C29 10, 29 14, 26 17"
                stroke="#f59e0b"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                opacity="0.3"
              />
            </svg>
            <span className="text-2xl font-extrabold tracking-tight wordmark">reps</span>
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
          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-1 flex-1 justify-center"
          >
            {NAV_ITEMS.map(({ view: v, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-current={view === v ? 'page' : undefined}
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

          {/* Desktop add + settings + sign out */}
          <button
            onClick={() => setView('add')}
            aria-label="Add task"
            className={`hidden md:flex flex-shrink-0 w-8 h-8 rounded-lg items-center justify-center text-lg font-light transition-colors ${
              view === 'add'
                ? 'bg-zinc-100 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
            title="Add task"
          >
            +
          </button>

          <a
            href="https://github.com/crgeee/reps"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-lg items-center justify-center text-sm transition-colors bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            title="Open source on GitHub"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.607.069-.607 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          </a>

          <a
            href="https://buymeacoffee.com/crgeee"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buy me a coffee"
            className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-lg items-center justify-center text-sm transition-colors bg-zinc-800 text-zinc-400 hover:bg-amber-900/40 hover:text-amber-400"
            title="Buy me a coffee"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21V19H20V21H2ZM20 8V5H18V8H20ZM20 3C20.5523 3 21 3.44772 21 4V9C21 9.55228 20.5523 10 20 10H18V11C18 13.7614 15.7614 16 13 16H9C6.23858 16 4 13.7614 4 11V4C4 3.44772 4.44772 3 5 3H20ZM16 5H6V11C6 12.6569 7.34315 14 9 14H13C14.6569 14 16 12.6569 16 11V5Z" />
            </svg>
          </a>

          <button
            onClick={() => setView('settings')}
            aria-label="Settings"
            className={`hidden md:flex flex-shrink-0 w-8 h-8 rounded-lg items-center justify-center transition-colors ${
              view === 'settings'
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
            title="Settings"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          <button
            onClick={logout}
            className="hidden md:block text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            Sign out
          </button>

          {/* Mobile hamburger */}
          <div ref={mobileMenuRef} className="md:hidden ml-auto relative">
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              aria-haspopup="true"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {mobileMenuOpen && (
              <nav
                aria-label="Mobile navigation"
                className="anim-slide-down absolute top-full right-0 mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-50"
              >
                {NAV_ITEMS.map(({ view: v, label }) => (
                  <button
                    key={v}
                    onClick={() => {
                      setView(v);
                      setMobileMenuOpen(false);
                    }}
                    aria-current={view === v ? 'page' : undefined}
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
                    onClick={() => {
                      setView('add');
                      setMobileMenuOpen(false);
                    }}
                    aria-current={view === 'add' ? 'page' : undefined}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      view === 'add'
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                    }`}
                  >
                    + Add Task
                  </button>
                  <a
                    href="https://github.com/crgeee/reps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors block"
                  >
                    Open source
                  </a>
                  <a
                    href="https://buymeacoffee.com/crgeee"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-left px-4 py-2.5 text-sm text-amber-400/70 hover:text-amber-400 hover:bg-zinc-800 transition-colors block"
                  >
                    Buy me a coffee
                  </a>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main id="main-content" className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-20 md:pb-5 w-full">
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm"
          >
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
            <div className="anim-page-enter">
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
                  onOptimisticUpdate={optimisticUpdateTask}
                  onBackgroundRefresh={refreshQuietly}
                  collectionStatuses={activeStatuses}
                />
              )}
              {view === 'review' && (
                <ReviewSession
                  dueTasks={filteredDueTasks}
                  onComplete={() => {
                    fetchData();
                    setView('dashboard');
                  }}
                />
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
                <TopicProgress tasks={filteredTasks} activeCollectionId={activeCollectionId} />
              )}
              {view === 'calendar' && (
                <div className="space-y-4">
                  <h1 className="text-lg font-bold tracking-tight">Calendar</h1>
                  <CalendarView tasks={filteredTasks} />
                </div>
              )}
              {view === 'export' && <ExportView />}
              {view === 'settings' && user && (
                <Settings user={user} onUserUpdate={handleUserUpdate} />
              )}
              {view === 'device-approve' && <DeviceApproval />}
              {view === 'privacy' && <PrivacyPolicy />}
              {view === 'terms' && <TermsOfService />}
            </div>
          </ErrorBoundary>
        )}
      </main>
      <FocusWidget />
      <Footer onNavigate={(v) => setView(v as View)} />

      {/* Mobile bottom nav */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800 z-40 safe-area-bottom"
      >
        <div className="flex items-stretch justify-around">
          {BOTTOM_NAV_ITEMS.map(({ view: v, label, Icon }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 pt-2.5 transition-colors ${
                view === v
                  ? 'text-amber-400'
                  : 'text-zinc-500 active:text-zinc-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
