import { useState, useEffect, useCallback } from 'react';
import type { User, SessionInfo, CustomTopic } from '../types';
import {
  updateProfile,
  getUserSessions,
  deleteUserSession,
  getCustomTopics,
  createCustomTopic,
  deleteCustomTopic,
  getAdminUsers,
  getAdminStats,
} from '../api';

interface Props {
  user: User;
  onUserUpdate: (user: User) => void;
}

export default function Settings({ user, onUserUpdate }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [timezone, setTimezone] = useState(user.timezone);
  const [theme, setTheme] = useState(user.theme);
  const [notifyDaily, setNotifyDaily] = useState(user.notifyDaily);
  const [notifyWeekly, setNotifyWeekly] = useState(user.notifyWeekly);
  const [dailyGoal, setDailyGoal] = useState(user.dailyReviewGoal);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [topics, setTopics] = useState<CustomTopic[]>([]);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicColor, setNewTopicColor] = useState('#6366f1');

  // Admin
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminStats, setAdminStats] = useState<{ users: number; tasks: number; activeSessions: number; totalReviews: number } | null>(null);

  const fetchSessions = useCallback(async () => {
    try { setSessions(await getUserSessions()); } catch { /* ignore */ }
  }, []);

  const fetchTopics = useCallback(async () => {
    try { setTopics(await getCustomTopics()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchTopics();
    if (user.isAdmin) {
      getAdminUsers().then(setAdminUsers).catch(() => {});
      getAdminStats().then(setAdminStats).catch(() => {});
    }
  }, [fetchSessions, fetchTopics, user.isAdmin]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateProfile({
        displayName: displayName || undefined,
        timezone,
        theme,
        notifyDaily,
        notifyWeekly,
        dailyReviewGoal: dailyGoal,
      });
      onUserUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSession(id: string) {
    await deleteUserSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleAddTopic() {
    if (!newTopicName.trim()) return;
    const topic = await createCustomTopic({ name: newTopicName.trim(), color: newTopicColor });
    setTopics((prev) => [...prev, topic]);
    setNewTopicName('');
  }

  async function handleDeleteTopic(id: string) {
    await deleteCustomTopic(id);
    setTopics((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-300">Profile</h2>
        <div className="grid gap-4 max-w-md">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <p className="text-zinc-300">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              maxLength={100}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Daily Review Goal</label>
            <input
              type="number"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
              min={1}
              max={50}
              className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-300">Notifications</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={notifyDaily} onChange={(e) => setNotifyDaily(e.target.checked)} className="rounded" />
            <span className="text-zinc-300">Daily briefing email</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={notifyWeekly} onChange={(e) => setNotifyWeekly(e.target.checked)} className="rounded" />
            <span className="text-zinc-300">Weekly insight email</span>
          </label>
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
      </button>

      {/* Custom Topics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-300">Custom Topics</h2>
        <div className="space-y-2">
          {topics.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-2 bg-zinc-900 rounded-lg">
              {t.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />}
              <span className="text-zinc-300 flex-1">{t.name}</span>
              <button
                onClick={() => handleDeleteTopic(t.id)}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Topic name"
            maxLength={50}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="color"
            value={newTopicColor}
            onChange={(e) => setNewTopicColor(e.target.value)}
            className="w-10 h-10 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer"
          />
          <button
            onClick={handleAddTopic}
            disabled={!newTopicName.trim()}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      {/* Active Sessions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-300">Active Sessions</h2>
        <div className="space-y-2">
          {sessions.length === 0 && <p className="text-zinc-500 text-sm">No active sessions.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg">
              <div className="flex-1">
                <p className="text-zinc-300 text-sm">{s.userAgent ?? 'Unknown device'}</p>
                <p className="text-zinc-500 text-xs">
                  Last active: {new Date(s.lastUsedAt).toLocaleDateString()}
                  {s.ipAddress && ` from ${s.ipAddress}`}
                </p>
              </div>
              <button
                onClick={() => handleDeleteSession(s.id)}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Admin Panel */}
      {user.isAdmin && (
        <section className="space-y-4 border-t border-zinc-800 pt-8">
          <h2 className="text-lg font-semibold text-zinc-300">Admin</h2>
          {adminStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Users', value: adminStats.users },
                { label: 'Tasks', value: adminStats.tasks },
                { label: 'Active Sessions', value: adminStats.activeSessions },
                { label: 'Total Reviews', value: adminStats.totalReviews },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-zinc-900 rounded-lg">
                  <p className="text-2xl font-bold text-zinc-100">{s.value}</p>
                  <p className="text-xs text-zinc-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-400">All Users</h3>
            {adminUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2 bg-zinc-900 rounded-lg">
                <span className="text-zinc-300 flex-1">{u.email}</span>
                <span className="text-zinc-500 text-xs">{u.displayName ?? ''}</span>
                <span className="text-zinc-600 text-xs">{new Date(u.createdAt).toLocaleDateString()}</span>
                {u.isAdmin && <span className="text-xs text-amber-500">admin</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
