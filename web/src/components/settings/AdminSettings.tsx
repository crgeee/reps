import { useState, useEffect } from 'react';
import type { User, AdminUser, CollectionTemplate } from '../../types';
import {
  getAdminUsers,
  getAdminStats,
  adminUpdateUser,
  getAdminTemplates,
  adminDeleteTemplate,
} from '../../api';
import { formatRelative } from '../../utils/format';
import { SectionHeader } from './shared';
import { logger } from '../../logger';

interface Props {
  user: User;
}

export default function AdminSettings({ user }: Props) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminTemplates, setAdminTemplates] = useState<CollectionTemplate[]>([]);
  const [adminStats, setAdminStats] = useState<{
    users: number;
    tasks: number;
    activeSessions: number;
    totalReviews: number;
  } | null>(null);

  useEffect(() => {
    getAdminUsers()
      .then(setAdminUsers)
      .catch((e) => {
        logger.error('Failed to load admin users', { error: String(e) });
      });
    getAdminStats()
      .then(setAdminStats)
      .catch((e) => {
        logger.error('Failed to load admin stats', { error: String(e) });
      });
    getAdminTemplates()
      .then(setAdminTemplates)
      .catch((e) => {
        logger.error('Failed to load admin templates', { error: String(e) });
      });
  }, []);

  return (
    <div className="space-y-5">
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
                      <span className="text-zinc-200 text-sm font-medium truncate">{u.email}</span>
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

      {adminTemplates.length > 0 && (
        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-2">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3">Templates</h3>
          {adminTemplates.map((t) => (
            <div key={t.id} className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {t.icon && <span className="text-sm">{t.icon}</span>}
                    <span className="text-zinc-200 text-sm font-medium truncate">{t.name}</span>
                    {t.isSystem && (
                      <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        SYSTEM
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    {!t.isSystem && t.userId && (
                      <span className="truncate max-w-[140px]" title={t.userId}>
                        user: {t.userId.slice(0, 8)}...
                      </span>
                    )}
                    <span>
                      {t.statuses.length} status{t.statuses.length !== 1 ? 'es' : ''}
                    </span>
                    <span>
                      {t.tasks.length} task{t.tasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {!t.isSystem && (
                  <button
                    title="Delete template"
                    onClick={async () => {
                      if (!confirm(`Delete template "${t.name}"?`)) return;
                      const prev = adminTemplates;
                      setAdminTemplates((cur) => cur.filter((at) => at.id !== t.id));
                      try {
                        await adminDeleteTemplate(t.id);
                      } catch {
                        setAdminTemplates(prev);
                      }
                    }}
                    className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
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
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
