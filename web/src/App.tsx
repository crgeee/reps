import { useState, useEffect, useCallback } from 'react';
import type { Task } from './types';
import { getTasks, getDueTasks, getStoredApiKey, setApiKey } from './api';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import ReviewSession from './components/ReviewSession';
import AddTask from './components/AddTask';
import TopicProgress from './components/TopicProgress';
import BoardView from './components/BoardView';

type View = 'dashboard' | 'tasks' | 'board' | 'review' | 'add' | 'progress';

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'tasks', label: 'Tasks' },
  { view: 'board', label: 'Board' },
  { view: 'review', label: 'Review' },
  { view: 'add', label: 'Add Task' },
  { view: 'progress', label: 'Progress' },
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dueTasks, setDueTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(!!getStoredApiKey());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTasks, due] = await Promise.all([getTasks(), getDueTasks()]);
      setTasks(allTasks);
      setDueTasks(due);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasApiKey) {
      fetchData();
    }
  }, [hasApiKey, fetchData]);

  function handleSetApiKey() {
    if (!apiKeyInput.trim()) return;
    setApiKey(apiKeyInput.trim());
    setApiKeyInput('');
    setHasApiKey(true);
  }

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
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setView('dashboard')}
            className="text-2xl font-bold tracking-tight hover:text-zinc-300 transition-colors"
          >
            reps
          </button>
          <nav className="flex gap-1">
            {NAV_ITEMS.map(({ view: v, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
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
            <div className="text-zinc-500">Loading...</div>
          </div>
        ) : (
          <>
            {view === 'dashboard' && (
              <Dashboard
                tasks={tasks}
                dueTasks={dueTasks}
                onStartReview={() => setView('review')}
                onNavigate={setView}
              />
            )}
            {view === 'tasks' && <TaskList tasks={tasks} onRefresh={fetchData} />}
            {view === 'board' && <BoardView tasks={tasks} onRefresh={fetchData} />}
            {view === 'review' && (
              <ReviewSession dueTasks={dueTasks} onComplete={fetchData} />
            )}
            {view === 'add' && (
              <AddTask
                onCreated={() => {
                  fetchData();
                  setView('tasks');
                }}
              />
            )}
            {view === 'progress' && <TopicProgress tasks={tasks} />}
          </>
        )}
      </main>
    </div>
  );
}
