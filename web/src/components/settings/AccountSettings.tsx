import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, SessionInfo, CustomTopic } from '../../types';
import { COLOR_SWATCHES } from '../../types';
import {
  getUserSessions,
  deleteUserSession,
  getCustomTopics,
  createCustomTopic,
  deleteCustomTopic,
} from '../../api';
import { parseUserAgent, formatRelative } from '../../utils/format';
import { logger } from '../../logger';
import { useAutoSave } from '../../hooks/useAutoSave';
import SaveIndicator from '../SaveIndicator';
import { SectionHeader, ListRow } from './shared';

interface Props {
  user: User;
  onProfileUpdate: (updates: Partial<User>) => Promise<void>;
}

export default function AccountSettings({ user, onProfileUpdate }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');

  // Auto-save display name
  const autoSaveValues = useMemo(() => ({ displayName }), [displayName]);

  const handleAutoSave = useCallback(
    async (values: typeof autoSaveValues) => {
      await onProfileUpdate({ displayName: values.displayName.trim() || null });
    },
    [onProfileUpdate],
  );

  const { status, error } = useAutoSave({
    values: autoSaveValues,
    onSave: handleAutoSave,
    delay: 800,
  });

  // Custom topics state
  const [topics, setTopics] = useState<CustomTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicColor, setNewTopicColor] = useState<string>(COLOR_SWATCHES[0]);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await getUserSessions());
    } catch (err) {
      logger.error('Failed to load sessions', { error: String(err) });
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const fetchTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      setTopics(await getCustomTopics());
    } catch (err) {
      logger.error('Failed to load topics', { error: String(err) });
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchTopics();
  }, [fetchSessions, fetchTopics]);

  async function handleDeleteSession(id: string) {
    try {
      await deleteUserSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      logger.error('Failed to revoke session', { sessionId: id, error: String(err) });
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
    } catch (err) {
      logger.error('Failed to delete topic', { topicId: id, error: String(err) });
    }
  }

  const emailHash = user.email.trim().toLowerCase();
  const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=96&d=mp`;

  return (
    <div className="space-y-8">
      {/* Profile */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <SectionHeader icon="user" title="Profile" />
          <SaveIndicator status={status} error={error} />
        </div>

        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-zinc-800">
            <img src={gravatarUrl} alt="" className="w-12 h-12 rounded-full bg-zinc-800" />
            <div>
              <p className="text-zinc-100 font-medium">{user.displayName || user.email}</p>
              <p className="text-zinc-500 text-sm">{user.email}</p>
            </div>
          </div>

          <label className="block max-w-sm">
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
        </div>
      </section>

      {/* Custom Topics */}
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

      {/* Active Sessions */}
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
    </div>
  );
}
