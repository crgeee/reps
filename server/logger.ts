import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');
const logDir = process.env.LOG_DIR ?? '/var/log/reps';

function createLogger() {
  if (isDev) {
    return pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    });
  }

  try {
    return pino(
      { level },
      pino.transport({
        targets: [
          {
            target: 'pino-roll',
            level,
            options: {
              file: `${logDir}/app.log`,
              frequency: 'daily',
              size: '50m',
              dateFormat: 'yyyy-MM-dd',
              mkdir: true,
              limit: { count: 14 },
            },
          },
          {
            target: 'pino/file',
            level,
            options: { destination: 1 },
          },
        ],
      }),
    );
  } catch (err) {
    // Fallback to stdout — log files, admin explorer, and MCP log server will not function
    const fallback = pino({ level });
    fallback.error(
      { err: err instanceof Error ? err.message : String(err), logDir },
      'Failed to initialize file logging transport — falling back to stdout only',
    );
    return fallback;
  }
}

export const logger = createLogger();
