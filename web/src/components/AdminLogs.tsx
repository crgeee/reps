import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useProtectedContext } from '../layouts/ProtectedLayout';
import { getLogs, getLogStats, getLogErrors, getLogRequestTrace } from '../api';
import type { LogEntry, LogStats, LogErrorSummary } from '../types';
import TimeSeriesChart from './TimeSeriesChart';
import BarChart from './BarChart';

type AutoRefresh = 0 | 5 | 15;
type SortColumn = 'time' | 'level' | 'status' | 'latency';
type SortDirection = 'asc' | 'desc';
type SortState = { column: SortColumn; direction: SortDirection } | null;
type StatusFilter = '' | '2xx' | '3xx' | '4xx' | '5xx';

type ColumnKey =
  | 'time'
  | 'level'
  | 'method'
  | 'path'
  | 'status'
  | 'latency'
  | 'user'
  | 'ip'
  | 'message';

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'time', label: 'Date / Time' },
  { key: 'level', label: 'Level' },
  { key: 'method', label: 'Method' },
  { key: 'path', label: 'Path' },
  { key: 'status', label: 'Status' },
  { key: 'latency', label: 'Latency' },
  { key: 'user', label: 'User' },
  { key: 'ip', label: 'IP' },
  { key: 'message', label: 'Message' },
];

const VALID_COLUMN_KEYS = new Set<ColumnKey>(ALL_COLUMNS.map((c) => c.key));
const SORTABLE_COLUMNS = new Set<ColumnKey>(['time', 'level', 'status', 'latency']);

const STORAGE_KEY = 'reps_log_columns';

const LEVEL_COLORS: Record<string, string> = {
  Info: 'bg-blue-500',
  Warn: 'bg-amber-500',
  Error: 'bg-red-500',
};

function loadVisibleColumns(): Set<ColumnKey> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) {
        const filtered = arr.filter((k: string) => VALID_COLUMN_KEYS.has(k as ColumnKey));
        if (filtered.length > 0) return new Set(filtered);
      }
    }
  } catch (err) {
    console.warn('Failed to load column preferences:', err);
  }
  return new Set(ALL_COLUMNS.map((c) => c.key));
}

function saveVisibleColumns(cols: Set<ColumnKey>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cols]));
  } catch (err) {
    console.warn('Failed to save column preferences:', err);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

interface Filters {
  level: string;
  path: string;
  from: string;
  to: string;
  search: string;
}

const EMPTY_FILTERS: Filters = { level: '', path: '', from: '', to: '', search: '' };

/** Formats a unix timestamp as "Mon D HH:MM:SS" (e.g., "Mar 3 14:05:22") */
function formatTime(unix: number): string {
  const d = new Date(unix);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${month} ${day} ${time}`;
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

function renderCell(key: ColumnKey, entry: LogEntry): ReactNode {
  switch (key) {
    case 'time':
      return (
        <span className="text-zinc-500 font-mono whitespace-nowrap">{formatTime(entry.time)}</span>
      );
    case 'level':
      return (
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${levelBadgeClasses(entry.levelLabel)}`}
        >
          {entry.levelLabel}
        </span>
      );
    case 'method':
      return <span className="text-zinc-300 font-mono">{entry.method ?? ''}</span>;
    case 'path':
      return (
        <span className="text-zinc-300 font-mono max-w-[200px] truncate block">
          {entry.path ?? ''}
        </span>
      );
    case 'status':
      return <span className={`font-mono ${statusColor(entry.status)}`}>{entry.status ?? ''}</span>;
    case 'latency':
      return (
        <span className="text-zinc-400 font-mono whitespace-nowrap">
          {entry.latency != null ? `${entry.latency}ms` : ''}
        </span>
      );
    case 'user':
      return <span className="text-zinc-400 font-mono">{entry.userId ?? ''}</span>;
    case 'ip':
      return <span className="text-zinc-400 font-mono">{entry.ip ?? ''}</span>;
    case 'message':
      return <span className="text-zinc-400 max-w-[300px] truncate block">{entry.msg}</span>;
  }
}

export default function AdminLogs() {
  const { user } = useProtectedContext();

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [autoRefresh, setAutoRefresh] = useState<AutoRefresh>(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [traceRequestId, setTraceRequestId] = useState<string | null>(null);
  const [traceEntries, setTraceEntries] = useState<LogEntry[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [sort, setSort] = useState<SortState>({ column: 'time', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadVisibleColumns);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [errorSummary, setErrorSummary] = useState<LogErrorSummary[]>([]);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEntries = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        if (!append) setLoading(true);
        setError(null);
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
      } catch (err) {
        console.error('Failed to fetch log entries:', err);
        setError('Failed to load log entries');
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters],
  );

  const fetchStats = useCallback(async () => {
    const [statsResult, errorsResult] = await Promise.allSettled([
      getLogStats(24),
      getLogErrors(24),
    ]);

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value);
    } else {
      console.error('Failed to fetch log stats:', statsResult.reason);
      setStats(null);
    }

    if (errorsResult.status === 'fulfilled') {
      setErrorSummary(errorsResult.value.errors.slice(0, 5));
    } else {
      console.error('Failed to fetch error summary:', errorsResult.reason);
      setErrorSummary([]);
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
      .catch((err) => {
        console.error('Failed to fetch request trace:', err);
        if (!cancelled) setTraceEntries([]);
      })
      .finally(() => {
        if (!cancelled) setTraceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [traceRequestId]);

  // Close column picker on outside click
  useEffect(() => {
    if (!columnPickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setColumnPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [columnPickerOpen]);

  const displayEntries = useMemo(() => {
    let filtered = entries;
    if (statusFilter) {
      const base = parseInt(statusFilter.charAt(0), 10) * 100;
      filtered = filtered.filter(
        (e) => e.status != null && e.status >= base && e.status < base + 100,
      );
    }
    if (!sort) return filtered;
    const { column, direction } = sort;
    const dir = direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[column] ?? -Infinity;
      const bv = b[column] ?? -Infinity;
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }, [entries, sort, statusFilter]);

  function handleSort(col: SortColumn) {
    if (sort?.column !== col) {
      setSort({ column: col, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      setSort({ column: col, direction: 'desc' });
    } else {
      setSort(null);
    }
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      saveVisibleColumns(next);
      return next;
    });
  }

  const levelDistribution = useMemo(() => {
    if (!stats) return {};
    const buckets: Record<string, number> = {};
    for (const h of stats.byHour) {
      buckets['Info'] = (buckets['Info'] ?? 0) + h.info;
      buckets['Warn'] = (buckets['Warn'] ?? 0) + h.warn;
      buckets['Error'] = (buckets['Error'] ?? 0) + h.error;
    }
    return Object.fromEntries(Object.entries(buckets).filter(([, v]) => v > 0));
  }, [stats]);

  const activeColumns = useMemo(
    () => ALL_COLUMNS.filter((col) => visibleColumns.has(col.key)),
    [visibleColumns],
  );

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Settings
          </button>
          <h1 className="text-xl font-bold text-zinc-100">Logs</h1>
        </div>
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

      {/* Charts */}
      {stats && stats.byHour.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="text-xs font-medium text-zinc-500 mb-3">Requests by Hour (24h)</h3>
            <TimeSeriesChart data={stats.byHour} />
          </div>
          <div className="space-y-3">
            {Object.keys(levelDistribution).length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="text-xs font-medium text-zinc-500 mb-3">Log Level Distribution</h3>
                <BarChart data={levelDistribution} colors={LEVEL_COLORS} />
              </div>
            )}
            {errorSummary.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="text-xs font-medium text-zinc-500 mb-3">Top Errors (24h)</h3>
                <BarChart
                  data={Object.fromEntries(
                    errorSummary.map((e) => [truncate(e.message, 40), e.count]),
                  )}
                  colors={Object.fromEntries(
                    errorSummary.map((e) => [truncate(e.message, 40), 'bg-red-500']),
                  )}
                />
              </div>
            )}
          </div>
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          >
            <option value="">All</option>
            <option value="2xx">2xx</option>
            <option value="3xx">3xx</option>
            <option value="4xx">4xx</option>
            <option value="5xx">5xx</option>
          </select>
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
                <div
                  key={i}
                  className="flex items-start gap-3 text-xs font-mono py-1.5 border-b border-zinc-800/50 last:border-0"
                >
                  <span className="text-zinc-500 shrink-0">{formatTime(entry.time)}</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${levelBadgeClasses(entry.levelLabel)}`}
                  >
                    {entry.levelLabel}
                  </span>
                  <span className="text-zinc-300 break-all">{entry.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Log table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        {/* Column picker */}
        <div className="flex items-center justify-end px-3 py-2 border-b border-zinc-800/50">
          <div className="relative" ref={columnPickerRef}>
            <button
              onClick={() => setColumnPickerOpen((o) => !o)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Select columns"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            {columnPickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-2 min-w-[160px]">
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

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
                  {activeColumns.map((col) =>
                    SORTABLE_COLUMNS.has(col.key) ? (
                      <SortableHeader
                        key={col.key}
                        column={col.key as SortColumn}
                        label={col.label}
                        sort={sort}
                        onSort={handleSort}
                      />
                    ) : (
                      <th key={col.key} className="text-left px-3 py-2.5 font-medium">
                        {col.label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, i) => (
                  <LogRow
                    key={`${entry.time}-${i}`}
                    entry={entry}
                    expanded={expandedRow === i}
                    onToggle={() => handleRowClick(i)}
                    onTraceClick={handleTraceClick}
                    activeColumns={activeColumns}
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

function SortableHeader({
  column,
  label,
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sort: SortState;
  onSort: (col: SortColumn) => void;
}) {
  const active = sort?.column === column;
  return (
    <th
      className="text-left px-3 py-2.5 font-medium cursor-pointer select-none hover:text-zinc-300 transition-colors"
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <span className="text-amber-400">{sort.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
        )}
      </span>
    </th>
  );
}

function LogRow({
  entry,
  expanded,
  onToggle,
  onTraceClick,
  activeColumns,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  onTraceClick: (reqId: string) => void;
  activeColumns: { key: ColumnKey; label: string }[];
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-zinc-800/50 cursor-pointer transition-colors hover:bg-zinc-800/40 ${
          expanded ? 'bg-zinc-800/30' : ''
        }`}
      >
        {activeColumns.map((col) => (
          <td key={col.key} className="px-3 py-2 text-xs">
            {renderCell(col.key, entry)}
          </td>
        ))}
      </tr>
      {expanded && (
        <tr className="border-b border-zinc-800/50">
          <td colSpan={activeColumns.length} className="px-4 py-3 bg-zinc-900/80">
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
              {(entry.userId || entry.ip || entry.userAgent) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {entry.userId && (
                    <div>
                      <span className="text-zinc-500">User: </span>
                      <span className="text-zinc-300 font-mono">{entry.userId}</span>
                    </div>
                  )}
                  {entry.ip && (
                    <div>
                      <span className="text-zinc-500">IP: </span>
                      <span className="text-zinc-300 font-mono">{entry.ip}</span>
                    </div>
                  )}
                  {entry.userAgent && (
                    <div>
                      <span className="text-zinc-500">User-Agent: </span>
                      <span className="text-zinc-300 font-mono text-[11px]">{entry.userAgent}</span>
                    </div>
                  )}
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
