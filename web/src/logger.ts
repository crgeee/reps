type LogLevel = 'error' | 'warn' | 'info';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

type LogHandler = (entry: LogEntry) => void;

const handlers: LogHandler[] = [
  // Default: console output
  (entry) => {
    const method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'info';
    const prefix = `[reps:${entry.level}]`;
    if (entry.context) {
      console[method](prefix, entry.message, entry.context);
    } else {
      console[method](prefix, entry.message);
    }
  },
];

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = { level, message, context, timestamp: new Date().toISOString() };
  for (const handler of handlers) {
    handler(entry);
  }
}

export const logger = {
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  /** Add a custom handler (e.g. remote reporting, toast notifications) */
  addHandler: (handler: LogHandler) => { handlers.push(handler); },
};
