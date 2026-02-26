import { useState, useEffect, useCallback } from 'react';
import type { User, AdminUser, SessionInfo, CustomTopic } from '../types';
import { COLOR_SWATCHES } from '../types';
import {
  updateProfile,
  getUserSessions,
  deleteUserSession,
  getCustomTopics,
  createCustomTopic,
  deleteCustomTopic,
  getAdminUsers,
  getAdminStats,
  adminUpdateUser,
} from '../api';
import { buildTimezoneOptions } from '../utils/timezone';
import { parseUserAgent, formatRelative } from '../utils/format';

const TIMEZONE_OPTIONS = buildTimezoneOptions();

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

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
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [topics, setTopics] = useState<CustomTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicColor, setNewTopicColor] = useState<string>(COLOR_SWATCHES[0]);
  const [topicError, setTopicError] = useState<string | null>(null);

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminStats, setAdminStats] = useState<{
    users: number;
    tasks: number;
    activeSessions: number;
    totalReviews: number;
  } | null>(null);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await getUserSessions());
    } catch {
      /* ignore */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const fetchTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      setTopics(await getCustomTopics());
    } catch {
      /* ignore */
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchTopics();
    if (user.isAdmin) {
      getAdminUsers()
        .then(setAdminUsers)
        .catch(() => {});
      getAdminStats()
        .then(setAdminStats)
        .catch(() => {});
    }
  }, [fetchSessions, fetchTopics, user.isAdmin]);

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await updateProfile({
        displayName: displayName.trim() || null,
        timezone,
        theme,
        notifyDaily,
        notifyWeekly,
        dailyReviewGoal: dailyGoal,
      } as Partial<User>);
      onUserUpdate(updated);
      setSaveMessage({ text: 'Settings saved', type: 'success' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({
        text: err instanceof Error ? err.message : 'Failed to save',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await deleteUserSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* ignore */
    }
  }

  async function handleAddTopic() {
    const name = newTopicName.trim();
    if (!name) return;
    if (name.length > 50) {
      setTopicError('Name must be 50 characters or less');
      return;
    }
    setTopicError(null);
    try {
      const topic = await createCustomTopic({ name, color: newTopicColor });
      setTopics((prev) => [...prev, topic]);
      setNewTopicName('');
    } catch (err) {
      setTopicError(err instanceof Error ? err.message : 'Failed to create topic');
    }
  }

  async function handleDeleteTopic(id: string) {
    try {
      await deleteCustomTopic(id);
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } catch {
      /* ignore */
    }
  }

  function handleGoalChange(value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setDailyGoal(Math.max(1, Math.min(50, num)));
  }

  const emailHash = user.email.trim().toLowerCase();
  const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=96&d=mp`;

  return (
    <div className="space-y-10 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* Profile Section */}
      <section className="space-y-5">
        <SectionHeader icon="user" title="Profile" />

        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-zinc-800">
            <img src={gravatarUrl} alt="" className="w-12 h-12 rounded-full bg-zinc-800" />
            <div>
              <p className="text-zinc-100 font-medium">{user.displayName || user.email}</p>
              <p className="text-zinc-500 text-sm">{user.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-400">Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                className="mt-1.5 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                placeholder="How you want to be called"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-400">Timezone</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-400">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
              >
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-400">Daily Review Goal</span>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDailyGoal((g) => Math.max(1, g - 1))}
                  className="w-9 h-9 flex items-center justify-center bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={dailyGoal}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  min={1}
                  max={50}
                  className="w-16 px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 text-center focus:outline-none focus:border-zinc-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setDailyGoal((g) => Math.min(50, g + 1))}
                  className="w-9 h-9 flex items-center justify-center bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
                >
                  +
                </button>
                <span className="text-sm text-zinc-500">reviews / day</span>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="space-y-5">
        <SectionHeader icon="bell" title="Notifications" />

        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
          <ToggleRow
            label="Daily briefing"
            description="Get a morning coaching message with your due reviews"
            checked={notifyDaily}
            onChange={setNotifyDaily}
          />
          <div className="border-t border-zinc-800" />
          <ToggleRow
            label="Weekly insight"
            description="Weekly analysis of your weakest topic with focus suggestions"
            checked={notifyWeekly}
            onChange={setNotifyWeekly}
          />
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {saveMessage && (
          <span
            className={`text-sm ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
          >
            {saveMessage.text}
          </span>
        )}
      </div>

      {/* Custom Topics Section */}
      <section className="space-y-5">
        <SectionHeader icon="tag" title="Custom Topics" />

        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4">
          <p className="text-sm text-zinc-500">
            Add topics beyond the built-in ones (coding, system-design, behavioral, papers).
          </p>

          {topicsLoading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : (
            <>
              {topics.length > 0 && (
                <div className="space-y-2">
                  {topics.map((t) => (
                    <ListRow key={t.id} onRemove={() => handleDeleteTopic(t.id)}>
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.color ?? '#71717a' }}
                      />
                      <span className="text-zinc-200 text-sm flex-1">{t.name}</span>
                    </ListRow>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => {
                      setNewTopicName(e.target.value);
                      setTopicError(null);
                    }}
                    placeholder="New topic name"
                    maxLength={50}
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-sm transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                  />
                  <button
                    onClick={handleAddTopic}
                    disabled={!newTopicName.trim()}
                    className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTopicColor(color)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        newTopicColor === color
                          ? 'ring-2 ring-zinc-300 ring-offset-2 ring-offset-zinc-950 scale-110'
                          : 'opacity-50 hover:opacity-80'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                {topicError && <p className="text-sm text-red-400">{topicError}</p>}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Active Sessions Section */}
      <section className="space-y-5">
        <SectionHeader icon="device" title="Active Sessions" />

        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          {sessionsLoading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-zinc-500 text-sm">No active sessions.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <ListRow key={s.id} onRemove={() => handleDeleteSession(s.id)} removeLabel="Revoke">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 text-sm truncate">{parseUserAgent(s.userAgent)}</p>
                    <p className="text-zinc-600 text-xs">
                      {s.ipAddress ?? 'Unknown IP'} · Last active {formatRelative(s.lastUsedAt)} ·
                      Expires {new Date(s.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </ListRow>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Admin Panel */}
      {user.isAdmin && (
        <section className="space-y-5 border-t border-zinc-800 pt-8">
          <SectionHeader icon="shield" title="Admin" />

          {adminStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Users', value: adminStats.users },
                { label: 'Tasks', value: adminStats.tasks },
                { label: 'Sessions', value: adminStats.activeSessions },
                { label: 'Reviews', value: adminStats.totalReviews },
              ].map((s) => (
                <div
                  key={s.label}
                  className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center"
                >
                  <p className="text-2xl font-bold text-zinc-100">{s.value}</p>
                  <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {adminUsers.length > 0 && (
            <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-2">
              <h3 className="text-sm font-semibold text-zinc-400 mb-3">All Users</h3>
              {adminUsers.map((u) => {
                const isSelf = u.id === user.id;
                return (
                  <div
                    key={u.id}
                    className={`px-4 py-3 bg-zinc-900 border rounded-lg ${u.isBlocked ? 'border-red-900/50 opacity-60' : 'border-zinc-800'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-200 text-sm font-medium truncate">
                            {u.email}
                          </span>
                          {u.isAdmin && (
                            <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              ADMIN
                            </span>
                          )}
                          {u.isBlocked && (
                            <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                              BLOCKED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          {u.displayName && <span>{u.displayName}</span>}
                          <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                          <span>
                            {u.taskCount} task{u.taskCount !== 1 ? 's' : ''}
                          </span>
                          {u.lastActiveAt && <span>Active {formatRelative(u.lastActiveAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          title={
                            isSelf
                              ? "Can't change own admin status"
                              : u.isAdmin
                                ? 'Remove admin'
                                : 'Make admin'
                          }
                          disabled={isSelf}
                          onClick={async () => {
                            const action = u.isAdmin ? 'remove admin from' : 'grant admin to';
                            if (!confirm(`Are you sure you want to ${action} ${u.email}?`)) return;
                            try {
                              await adminUpdateUser(u.id, { isAdmin: !u.isAdmin });
                              setAdminUsers((prev) =>
                                prev.map((au) =>
                                  au.id === u.id ? { ...au, isAdmin: !au.isAdmin } : au,
                                ),
                              );
                            } catch {
                              /* ignore */
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            isSelf
                              ? 'text-zinc-700 cursor-not-allowed'
                              : u.isAdmin
                                ? 'text-amber-500 hover:bg-amber-500/10'
                                : 'text-zinc-600 hover:text-amber-500 hover:bg-amber-500/10'
                          }`}
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
                              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                            />
                          </svg>
                        </button>
                        <button
                          title={
                            isSelf
                              ? "Can't block yourself"
                              : u.isBlocked
                                ? 'Unblock user'
                                : 'Block user'
                          }
                          disabled={isSelf}
                          onClick={async () => {
                            const action = u.isBlocked ? 'unblock' : 'block';
                            if (!confirm(`Are you sure you want to ${action} ${u.email}?`)) return;
                            try {
                              await adminUpdateUser(u.id, { isBlocked: !u.isBlocked });
                              setAdminUsers((prev) =>
                                prev.map((au) =>
                                  au.id === u.id ? { ...au, isBlocked: !au.isBlocked } : au,
                                ),
                              );
                            } catch {
                              /* ignore */
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            isSelf
                              ? 'text-zinc-700 cursor-not-allowed'
                              : u.isBlocked
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10'
                          }`}
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
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// --- Reusable sub-components ---

const SECTION_ICONS: Record<string, JSX.Element> = {
  user: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  ),
  bell: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
    />
  ),
  tag: (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </>
  ),
  device: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
    />
  ),
  shield: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
    />
  ),
};

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  const isAmber = icon === 'shield';
  return (
    <div className="flex items-center gap-2">
      <svg
        className={`w-5 h-5 ${isAmber ? 'text-amber-500' : 'text-zinc-500'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        {SECTION_ICONS[icon]}
      </svg>
      <h2 className="text-lg font-semibold text-zinc-200">{title}</h2>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div>
        <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-zinc-100' : 'bg-zinc-700'}`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full transition-all ${checked ? 'left-5 bg-zinc-900' : 'left-1 bg-zinc-400'}`}
        />
      </div>
    </label>
  );
}

function ListRow({
  children,
  onRemove,
  removeLabel = 'Remove',
}: {
  children: React.ReactNode;
  onRemove: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg group">
      {children}
      <button
        onClick={onRemove}
        className="text-xs text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
      >
        {removeLabel}
      </button>
    </div>
  );
}
