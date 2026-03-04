import { createReadStream, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { logger } from '../logger.js';

const LOG_DIR = process.env.LOG_DIR ?? '/var/log/reps';
const NGINX_LOG_DIR = process.env.NGINX_LOG_DIR ?? '/var/log/nginx';

export interface LogEntry {
  level: number;
  levelLabel: string;
  time: number;
  msg: string;
  reqId?: string;
  method?: string;
  path?: string;
  status?: number;
  latency?: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  err?: { message: string; stack?: string };
  [key: string]: unknown;
}

const LEVEL_LABELS: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

const LEVEL_NUMBERS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

function parseLine(line: string): LogEntry | null {
  try {
    const obj = JSON.parse(line);
    if (
      typeof obj.level !== 'number' ||
      typeof obj.time !== 'number' ||
      typeof obj.msg !== 'string'
    ) {
      return null;
    }
    return {
      ...obj,
      levelLabel: LEVEL_LABELS[obj.level] ?? 'unknown',
    };
  } catch {
    return null;
  }
}

/** List log files sorted newest first */
export function getLogFiles(): string[] {
  try {
    const files = readdirSync(LOG_DIR)
      .filter((f) => f.startsWith('app') && f.endsWith('.log'))
      .map((f) => ({
        name: f,
        path: join(LOG_DIR, f),
        mtime: statSync(join(LOG_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.map((f) => f.path);
  } catch (err) {
    logger.error({ err, logDir: LOG_DIR }, 'Failed to read log directory');
    return [];
  }
}

/** Read all entries from a log file with optional filters */
async function readLogFile(
  filePath: string,
  filter?: {
    level?: string;
    search?: string;
    path?: string;
    reqId?: string;
    from?: number;
    to?: number;
  },
): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  const minLevel = filter?.level ? (LEVEL_NUMBERS[filter.level] ?? 0) : 0;
  const searchLower = filter?.search?.toLowerCase();

  try {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const entry = parseLine(line);
      if (!entry) continue;
      if (minLevel && entry.level < minLevel) continue;
      if (filter?.from && entry.time < filter.from) continue;
      if (filter?.to && entry.time > filter.to) continue;
      if (filter?.path && entry.path !== filter.path) continue;
      if (filter?.reqId && entry.reqId !== filter.reqId) continue;
      if (searchLower) {
        const text = (entry.msg + JSON.stringify(entry.err ?? '')).toLowerCase();
        if (!text.includes(searchLower)) continue;
      }
      entries.push(entry);
    }
  } catch (err) {
    logger.error({ err, filePath }, 'Failed to read log file');
  }

  return entries;
}

/** Tail the most recent N log entries */
export async function tailLogs(lines = 50, level?: string): Promise<LogEntry[]> {
  const files = getLogFiles();
  if (files.length === 0) return [];

  const allEntries: LogEntry[] = [];
  for (const file of files) {
    const entries = await readLogFile(file, { level });
    allEntries.push(...entries);
    if (allEntries.length >= lines) break;
  }

  return allEntries.sort((a, b) => a.time - b.time).slice(-lines);
}

/** Search logs across files with filters, supporting offset for pagination */
export async function searchLogs(opts: {
  query?: string;
  level?: string;
  path?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: LogEntry[]; totalMatched: number }> {
  const files = getLogFiles();
  const limit = opts.limit ?? 200;
  const offset = opts.offset ?? 0;
  const from = opts.from ? new Date(opts.from).getTime() : undefined;
  const to = opts.to ? new Date(opts.to).getTime() : undefined;

  if (from !== undefined && Number.isNaN(from)) {
    throw new Error('Invalid "from" date');
  }
  if (to !== undefined && Number.isNaN(to)) {
    throw new Error('Invalid "to" date');
  }

  const allEntries: LogEntry[] = [];
  for (const file of files) {
    const entries = await readLogFile(file, {
      search: opts.query,
      level: opts.level,
      path: opts.path,
      from,
      to,
    });
    allEntries.push(...entries);
    if (allEntries.length >= offset + limit) break;
  }

  return {
    entries: allEntries.slice(offset, offset + limit),
    totalMatched: allEntries.length,
  };
}

/** Get all log entries for a specific request ID (capped at 500) */
export async function getRequestTrace(requestId: string): Promise<LogEntry[]> {
  const files = getLogFiles();
  const allEntries: LogEntry[] = [];
  const limit = 500;

  for (const file of files) {
    const entries = await readLogFile(file, { reqId: requestId });
    allEntries.push(...entries);
    if (allEntries.length >= limit) break;
  }

  return allEntries.sort((a, b) => a.time - b.time).slice(0, limit);
}

/** Aggregate error counts by message over the last N hours */
export async function getErrorSummary(
  hours = 24,
): Promise<{ message: string; count: number; lastSeen: number }[]> {
  const from = Date.now() - hours * 60 * 60 * 1000;
  const files = getLogFiles();
  const counts = new Map<string, { count: number; lastSeen: number }>();

  for (const file of files) {
    const entries = await readLogFile(file, { level: 'error', from });
    for (const entry of entries) {
      const key = entry.err?.message ?? entry.msg;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, entry.time);
      } else {
        counts.set(key, { count: 1, lastSeen: entry.time });
      }
    }
  }

  return Array.from(counts.entries())
    .map(([message, data]) => ({ message, ...data }))
    .sort((a, b) => b.count - a.count);
}

/** Find requests above a latency threshold */
export async function getSlowRequests(thresholdMs = 1000, limit = 50): Promise<LogEntry[]> {
  const files = getLogFiles();
  const slow: LogEntry[] = [];

  for (const file of files) {
    const entries = await readLogFile(file);
    for (const entry of entries) {
      if (entry.latency && entry.latency > thresholdMs) {
        slow.push(entry);
        if (slow.length >= limit) break;
      }
    }
    if (slow.length >= limit) break;
  }

  return slow.sort((a, b) => (b.latency ?? 0) - (a.latency ?? 0)).slice(0, limit);
}

// --- Nginx error log parsing ---

export interface NginxErrorEntry {
  time: number;
  level: string;
  message: string;
  client?: string;
  server?: string;
  request?: string;
  upstream?: string;
  host?: string;
}

// Matches: 2026/03/04 04:07:27 [error] 197321#197321: *1511 <message>
const NGINX_LINE_RE = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)] \d+#\d+: (?:\*\d+ )?(.+)$/;

const NGINX_FIELD_RE = /(\w+): (.+?)(?=, \w+:|$)/g;

function parseNginxLine(line: string): NginxErrorEntry | null {
  const m = line.match(NGINX_LINE_RE);
  if (!m) return null;

  const time = new Date(m[1].replace(/\//g, '-')).getTime();
  if (Number.isNaN(time)) return null;

  const rawMsg = m[3];
  const entry: NginxErrorEntry = { time, level: m[2], message: rawMsg };

  // Extract structured fields from the message tail
  for (const match of rawMsg.matchAll(NGINX_FIELD_RE)) {
    const key = match[1];
    const val = match[2].trim().replace(/^"|"$/g, '');
    if (key === 'client') entry.client = val;
    else if (key === 'server') entry.server = val;
    else if (key === 'request') entry.request = val;
    else if (key === 'upstream') entry.upstream = val;
    else if (key === 'host') entry.host = val;
  }

  return entry;
}

function getNginxLogFiles(): string[] {
  try {
    const files = readdirSync(NGINX_LOG_DIR)
      .filter((f) => f.startsWith('error') && f.endsWith('.log'))
      .map((f) => ({
        name: f,
        path: join(NGINX_LOG_DIR, f),
        mtime: statSync(join(NGINX_LOG_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.map((f) => f.path);
  } catch (err) {
    logger.error({ err, dir: NGINX_LOG_DIR }, 'Failed to read nginx log directory');
    return [];
  }
}

async function readNginxLogFile(
  filePath: string,
  filter?: { from?: number; to?: number; search?: string },
): Promise<NginxErrorEntry[]> {
  const entries: NginxErrorEntry[] = [];
  const searchLower = filter?.search?.toLowerCase();

  try {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const entry = parseNginxLine(line);
      if (!entry) continue;
      if (filter?.from && entry.time < filter.from) continue;
      if (filter?.to && entry.time > filter.to) continue;
      if (searchLower && !entry.message.toLowerCase().includes(searchLower)) continue;
      entries.push(entry);
    }
  } catch (err) {
    logger.error({ err, filePath }, 'Failed to read nginx log file');
  }

  return entries;
}

/** Get nginx error log entries for the last N hours */
export async function getNginxErrors(opts?: {
  hours?: number;
  search?: string;
  limit?: number;
}): Promise<NginxErrorEntry[]> {
  const hours = opts?.hours ?? 24;
  const limit = opts?.limit ?? 200;
  const from = Date.now() - hours * 60 * 60 * 1000;
  const files = getNginxLogFiles();
  const allEntries: NginxErrorEntry[] = [];

  for (const file of files) {
    const entries = await readNginxLogFile(file, { from, search: opts?.search });
    allEntries.push(...entries);
    if (allEntries.length >= limit) break;
  }

  return allEntries.sort((a, b) => b.time - a.time).slice(0, limit);
}

/** Get stats: counts by level and hour */
export async function getLogStats(hours = 24): Promise<{
  byHour: { hour: string; info: number; warn: number; error: number; total: number }[];
  totalRequests: number;
  totalErrors: number;
  avgLatency: number;
  p95Latency: number;
}> {
  const from = Date.now() - hours * 60 * 60 * 1000;
  const files = getLogFiles();
  const hourBuckets = new Map<
    string,
    { info: number; warn: number; error: number; total: number }
  >();
  const latencies: number[] = [];
  let totalRequests = 0;
  let totalErrors = 0;

  for (const file of files) {
    const entries = await readLogFile(file, { from });
    for (const entry of entries) {
      const hour = new Date(entry.time).toISOString().slice(0, 13) + ':00';
      const bucket = hourBuckets.get(hour) ?? { info: 0, warn: 0, error: 0, total: 0 };
      bucket.total++;
      if (entry.level >= 50) {
        bucket.error++;
        totalErrors++;
      } else if (entry.level >= 40) bucket.warn++;
      else bucket.info++;
      hourBuckets.set(hour, bucket);

      if (entry.latency != null) {
        latencies.push(entry.latency);
        totalRequests++;
      }
    }
  }

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p95Latency = latencies.length ? (latencies[Math.floor(latencies.length * 0.95)] ?? 0) : 0;

  const byHour = Array.from(hourBuckets.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  return {
    byHour,
    totalRequests,
    totalErrors,
    avgLatency: Math.round(avgLatency),
    p95Latency: Math.round(p95Latency),
  };
}
