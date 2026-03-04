import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router';
import { useProtectedContext } from '../layouts/ProtectedLayout';
import { getLogs, getLogStats, getLogRequestTrace } from '../api';
import type { LogEntry, LogStats } from '../types';

type AutoRefresh = 0 | 5 | 15;

interface Filters {
  level: string;
  path: string;
  from: string;
  to: string;
  search: string;
}

const EMPTY_FILTERS: Filters = { level: '', path: '', from: '', to: '', search: '' };

function formatTime(unix: number): string {
  const d = new Date(unix);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function levelBadgeClasses(label: string): string {
  const l = label.toLowerCase();
  if (l === 'error' || l === 'fatal') return 'text-red-400 bg-red-500/10 border border-red-500/20';
  if (l === 'warn') return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
  if (l === 'info') return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
  return 'text-zinc-500 bg-zinc-500/10 border border-zinc-500/20';
}

function statusColor(status?: number): string {
  if (!status) return 'text-zinc-400';
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-amber-400';
  if (status >= 200 && status < 300) return 'text-green-400';
  return 'text-zinc-400';
}

export default function AdminLogs() {
  const { user } = useProtectedContext();

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [autoRefresh, setAutoRefresh] = useState<AutoRefresh>(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [traceRequestId, setTraceRequestId] = useState<string | null>(null);
  const [traceEntries, setTraceEntries] = useState<LogEntry[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEntries = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        if (!append) setLoading(true);
        const params: Record<string, string | number> = { page: pageNum, limit: 50 };
        if (appliedFilters.level) params.level = appliedFilters.level;
        if (appliedFilters.path) params.path = appliedFilters.path;
        if (appliedFilters.from) params.from = appliedFilters.from;
        if (appliedFilters.to) params.to = appliedFilters.to;
        if (appliedFilters.search) params.search = appliedFilters.search;

        const res = await getLogs(params as Parameters<typeof getLogs>[0]);
        if (append) {
          setEntries((prev) => [...prev, ...res.entries]);
        } else {
          setEntries(res.entries);
        }
        setHasMore(res.hasMore);
      } catch {
        // silently fail on refresh
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters],
  );

  const fetchStats = useCallback(async () => {
    try {
      const s = await getLogStats(24);
      setStats(s);
    } catch {
      // ignore
    }
  }, []);

  // Initial load + filter changes
  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
    fetchEntries(1, false);
    fetchStats();
  }, [fetchEntries, fetchStats]);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoRefresh > 0) {
      intervalRef.current = setInterval(() => {
        fetchEntries(1, false);
        fetchStats();
      }, autoRefresh * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchEntries, fetchStats]);

  // Trace fetching
  useEffect(() => {
    if (!traceRequestId) {
      setTraceEntries([]);
      return;
    }
    let cancelled = false;
    setTraceLoading(true);
    getLogRequestTrace(traceRequestId)
      .then((res) => {
        if (!cancelled) setTraceEntries(res.entries);
      })
      .catch(() => {
        if (!cancelled) setTraceEntries([]);
      })
      .finally(() => {
        if (!cancelled) setTraceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [traceRequestId]);

  if (!user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  function handleApply() {
    setAppliedFilters({ ...filters });
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    fetchEntries(next, true);
  }

  function handleRowClick(index: number) {
    setExpandedRow(expandedRow === index ? null : index);
  }

  function handleTraceClick(reqId: string) {
    setTraceRequestId(reqId);
    setExpandedRow(null);
  }

  const refreshOptions: { label: string; value: AutoRefresh }[] = [
    { label: 'Off', value: 0 },
    { label: '5s', value: 5 },
    { label: '15s', value: 15 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Logs</h1>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 mr-1">Auto-refresh:</span>
          {refreshOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAutoRefresh(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                autoRefresh === opt.value
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Requests" value={stats.totalRequests.toLocaleString()} />
          <StatCard
            label="Total Errors"
            value={stats.totalErrors.toLocaleString()}
            valueClass={stats.totalErrors > 0 ? 'text-red-400' : undefined}
          />
          <StatCard label="Avg Latency" value={`${Math.round(stats.avgLatency)}ms`} />
          <StatCard label="P95 Latency" value={`${Math.round(stats.p95Latency)}ms`} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Level</label>
          <select
            value={filters.level}
            onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          >
            <option value="">All</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Path</label>
          <input
            type="text"
            placeholder="e.g. /tasks"
            value={filters.path}
            onChange={(e) => setFilters((f) => ({ ...f, path: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 w-32"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
          <label className="text-xs text-zinc-500">Search</label>
          <input
            type="text"
            placeholder="Search messages..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Trace view */}
      {traceRequestId && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">
              Request trace: <span className="text-amber-400 font-mono">{traceRequestId}</span>
            </h2>
            <button
              onClick={() => setTraceRequestId(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Close
            </button>
          </div>
          {traceLoading ? (
            <p className="text-xs text-zinc-500">Loading trace...</p>
          ) : traceEntries.length === 0 ? (
            <p className="text-xs text-zinc-500">No entries found for this request.</p>
          ) : (
            <div className="space-y-1">
              {traceEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 text-xs font-mono py-1.5 border-b border-zinc-800/50 last:border-0">
                  <span className="text-zinc-500 shrink-0">{formatTime(entry.time)}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${levelBadgeClasses(entry.levelLabel)}`}>
                    {entry.levelLabel}
                  </span>
                  <span className="text-zinc-300 break-all">{entry.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-5 w-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-12">No log entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="text-left px-3 py-2.5 font-medium">Time</th>
                  <th className="text-left px-3 py-2.5 font-medium">Level</th>
                  <th className="text-left px-3 py-2.5 font-medium">Method</th>
                  <th className="text-left px-3 py-2.5 font-medium">Path</th>
                  <th className="text-left px-3 py-2.5 font-medium">Status</th>
                  <th className="text-left px-3 py-2.5 font-medium">Latency</th>
                  <th className="text-left px-3 py-2.5 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <LogRow
                    key={`${entry.time}-${i}`}
                    entry={entry}
                    expanded={expandedRow === i}
                    onToggle={() => handleRowClick(i)}
                    onTraceClick={handleTraceClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && !loading && (
          <div className="border-t border-zinc-800 px-3 py-3 text-center">
            <button
              onClick={handleLoadMore}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${valueClass ?? 'text-zinc-100'}`}>{value}</p>
    </div>
  );
}

function LogRow({
  entry,
  expanded,
  onToggle,
  onTraceClick,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  onTraceClick: (reqId: string) => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-zinc-800/50 cursor-pointer transition-colors hover:bg-zinc-800/40 ${
          expanded ? 'bg-zinc-800/30' : ''
        }`}
      >
        <td className="px-3 py-2 text-xs text-zinc-500 font-mono whitespace-nowrap">
          {formatTime(entry.time)}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${levelBadgeClasses(entry.levelLabel)}`}
          >
            {entry.levelLabel}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-zinc-300 font-mono">{entry.method ?? ''}</td>
        <td className="px-3 py-2 text-xs text-zinc-300 font-mono max-w-[200px] truncate">
          {entry.path ?? ''}
        </td>
        <td className={`px-3 py-2 text-xs font-mono ${statusColor(entry.status)}`}>
          {entry.status ?? ''}
        </td>
        <td className="px-3 py-2 text-xs text-zinc-400 font-mono whitespace-nowrap">
          {entry.latency != null ? `${entry.latency}ms` : ''}
        </td>
        <td className="px-3 py-2 text-xs text-zinc-400 max-w-[300px] truncate">{entry.msg}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-zinc-800/50">
          <td colSpan={7} className="px-4 py-3 bg-zinc-900/80">
            <div className="space-y-2 text-xs">
              {entry.reqId && (
                <div>
                  <span className="text-zinc-500">Request ID: </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTraceClick(entry.reqId!);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-mono underline underline-offset-2 transition-colors"
                  >
                    {entry.reqId}
                  </button>
                </div>
              )}
              {entry.err?.stack && (
                <div>
                  <p className="text-zinc-500 mb-1">Stack trace:</p>
                  <pre className="text-red-400/80 whitespace-pre-wrap font-mono text-[11px] bg-zinc-950 rounded-lg p-2 border border-zinc-800 overflow-x-auto">
                    {entry.err.stack}
                  </pre>
                </div>
              )}
              <details>
                <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors">
                  Full JSON
                </summary>
                <pre className="mt-1 text-zinc-400 whitespace-pre-wrap font-mono text-[11px] bg-zinc-950 rounded-lg p-2 border border-zinc-800 overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify(entry, null, 2)}
                </pre>
              </details>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
