import { useState, useEffect, useCallback } from 'react';
import type { User } from '../../types';
import type { McpKey } from '../../api';
import { listMcpKeys, createMcpKey, revokeMcpKey, toggleMcp, getMe } from '../../api';
import { formatRelative } from '../../utils/format';
import { logger } from '../../logger';
import { SectionHeader, ToggleRow } from './shared';

const SCOPE_OPTIONS = [
  { value: 'read', label: 'Read', description: 'View tasks, collections, and stats' },
  { value: 'write', label: 'Write', description: 'Create and update tasks, notes, reviews' },
  { value: 'ai', label: 'AI', description: 'Access AI coaching and evaluation features' },
];

const TTL_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
];

interface Props {
  user: User;
  onUserUpdate: (user: User) => void;
}

export default function McpSettings({ user, onUserUpdate }: Props) {
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read', 'write']);
  const [newKeyTtl, setNewKeyTtl] = useState('90');
  const [rawKeyDisplay, setRawKeyDisplay] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!user.mcpEnabled) return;
    setLoading(true);
    try {
      const result = await listMcpKeys();
      setKeys(result);
    } catch (err) {
      logger.error('Failed to load MCP keys', { error: String(err) });
    } finally {
      setLoading(false);
    }
  }, [user.mcpEnabled]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleToggleMcp(enabled: boolean) {
    try {
      await toggleMcp(enabled);
      const updated = await getMe();
      onUserUpdate(updated);
      if (enabled) {
        fetchKeys();
      }
    } catch (err) {
      logger.error('Failed to toggle MCP', { error: String(err) });
    }
  }

  function handleScopeToggle(scope: string) {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreateKey() {
    const name = newKeyName.trim();
    if (!name) return;
    if (newKeyScopes.length === 0) {
      setError('Select at least one scope');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await createMcpKey(name, newKeyScopes, Number(newKeyTtl));
      setKeys((prev) => [result.key, ...prev]);
      setRawKeyDisplay(result.rawKey);
      setNewKeyName('');
      setNewKeyScopes(['read', 'write']);
      setNewKeyTtl('90');
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    try {
      await revokeMcpKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) {
      logger.error('Failed to revoke MCP key', { keyId, error: String(err) });
    }
  }

  function handleCopyKey() {
    if (rawKeyDisplay) {
      navigator.clipboard.writeText(rawKeyDisplay);
    }
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const apiBaseUrl = window.location.origin;

  return (
    <div className="space-y-8">
      {/* MCP Toggle */}
      <section className="space-y-5">
        <SectionHeader icon="plug" title="MCP Integration" />

        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4">
          <ToggleRow
            label="Enable MCP Server"
            description="Allow AI assistants like Claude Code and Claude Desktop to access your reps data via the Model Context Protocol."
            checked={user.mcpEnabled}
            onChange={handleToggleMcp}
          />
        </div>
      </section>

      {user.mcpEnabled && (
        <>
          {/* Raw key display (shown once after creation) */}
          {rawKeyDisplay && (
            <section>
              <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-amber-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-amber-500">
                    This key will only be shown once
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono text-sm break-all">
                    {rawKeyDisplay}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="px-4 py-3 bg-amber-500 text-zinc-950 rounded-xl hover:bg-amber-400 transition-colors text-sm font-medium flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
                <button
                  onClick={() => setRawKeyDisplay(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </section>
          )}

          {/* Key Management */}
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <SectionHeader icon="shield" title="API Keys" />
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm font-medium"
                >
                  Create Key
                </button>
              )}
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-400">Key Name</span>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Claude Desktop, CI Pipeline"
                    maxLength={100}
                    className="mt-1.5 w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 transition-colors"
                  />
                </label>

                <div>
                  <span className="text-sm font-medium text-zinc-400">Scopes</span>
                  <div className="mt-2 space-y-2">
                    {SCOPE_OPTIONS.map((scope) => (
                      <label
                        key={scope.value}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={newKeyScopes.includes(scope.value)}
                          onChange={() => handleScopeToggle(scope.value)}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-0"
                        />
                        <div>
                          <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">
                            {scope.label}
                          </p>
                          <p className="text-xs text-zinc-500">{scope.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="block max-w-xs">
                  <span className="text-sm font-medium text-zinc-400">Expiration</span>
                  <select
                    value={newKeyTtl}
                    onChange={(e) => setNewKeyTtl(e.target.value)}
                    className="mt-1.5 w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-amber-500/40 transition-colors"
                  >
                    {TTL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim() || creating}
                    className="px-4 py-3 bg-amber-500 text-zinc-950 rounded-xl hover:bg-amber-400 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Key'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setError(null);
                    }}
                    className="px-4 py-3 text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Keys table */}
            <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              {loading ? (
                <p className="text-zinc-500 text-sm">Loading...</p>
              ) : activeKeys.length === 0 ? (
                <p className="text-zinc-500 text-sm">
                  No API keys yet. Create one to connect AI assistants.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-zinc-200 text-sm font-medium">{key.name}</p>
                          <code className="text-xs text-zinc-500 font-mono">
                            {key.keyPrefix}...
                          </code>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs font-medium"
                            >
                              {scope}
                            </span>
                          ))}
                          <span className="text-zinc-600 text-xs">
                            {key.lastUsedAt
                              ? `Used ${formatRelative(key.lastUsedAt)}`
                              : 'Never used'}
                          </span>
                          {key.expiresAt && (
                            <span className="text-zinc-600 text-xs">
                              Expires {new Date(key.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Configuration Example */}
          <section className="space-y-5">
            <SectionHeader icon="globe" title="Configuration" />

            <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4">
              <p className="text-sm text-zinc-500">
                Add this to your AI assistant configuration to connect it to reps.
              </p>

              <div>
                <p className="text-xs font-medium text-zinc-400 mb-2">
                  Claude Desktop (claude_desktop_config.json)
                </p>
                <pre className="px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-mono overflow-x-auto">
                  {JSON.stringify(
                    {
                      mcpServers: {
                        reps: {
                          url: `${apiBaseUrl}/mcp`,
                          headers: {
                            Authorization: 'Bearer YOUR_MCP_KEY',
                          },
                        },
                      },
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-400 mb-2">Claude Code (.mcp.json)</p>
                <pre className="px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 font-mono overflow-x-auto">
                  {JSON.stringify(
                    {
                      mcpServers: {
                        reps: {
                          type: 'url',
                          url: `${apiBaseUrl}/mcp`,
                          headers: {
                            Authorization: 'Bearer YOUR_MCP_KEY',
                          },
                        },
                      },
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
