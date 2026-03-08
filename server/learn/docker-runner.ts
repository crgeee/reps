import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../logger.js';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  /** True when Docker itself failed (not a user code error) */
  infrastructureError?: boolean;
}

export interface QueueConfig {
  maxConcurrent: number;
}

export class ExecutionQueue {
  private active = 0;
  private max: number;

  constructor(config: QueueConfig) {
    this.max = config.maxConcurrent;
  }

  get activeCount(): number {
    return this.active;
  }

  get isBusy(): boolean {
    return this.active >= this.max;
  }

  acquire(): boolean {
    if (this.isBusy) return false;
    this.active++;
    return true;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
  }
}

export interface CircuitBreakerConfig {
  threshold: number;
  cooldownMs: number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private threshold: number;
  private cooldownMs: number;

  constructor(config: CircuitBreakerConfig) {
    this.threshold = config.threshold;
    this.cooldownMs = config.cooldownMs;
  }

  get isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    if (this.openedAt && Date.now() - this.openedAt > this.cooldownMs) {
      this.failures = 0;
      this.openedAt = null;
      return false;
    }
    return true;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openedAt = Date.now();
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }
}

export function sanitizeOutput(output: string, maxLength = 65536): string {
  let sanitized = output
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '\n[truncated]';
  }

  return sanitized;
}

export interface RunCodeOptions {
  code: string;
  timeoutSeconds?: number;
  memoryMb?: number;
  image?: string;
}

export async function runCode(options: RunCodeOptions): Promise<ExecutionResult> {
  const { code, timeoutSeconds = 30, memoryMb = 128, image = 'reps-runner-python' } = options;

  const executionId = randomUUID();
  const codeDir = join(tmpdir(), `reps-code-${executionId}`);
  const codePath = join(codeDir, 'code.py');

  await mkdir(codeDir, { recursive: true });
  await writeFile(codePath, code, 'utf-8');

  const start = Date.now();

  try {
    return await new Promise<ExecutionResult>((resolve) => {
      const args = [
        'run',
        '--rm',
        '--network=none',
        `--memory=${memoryMb}m`,
        '--cpus=0.5',
        '--read-only',
        '--tmpfs',
        '/tmp:size=10m,noexec,nosuid',
        '--no-new-privileges',
        '--cap-drop=ALL',
        '--pids-limit=50',
        '--ulimit',
        'nproc=64:64',
        '--ulimit',
        'fsize=10485760:10485760',
        '--security-opt=seccomp=default',
        '--user',
        '1000:1000',
        '-v',
        `${codePath}:/app/code.py:ro`,
        image,
        'timeout',
        String(timeoutSeconds),
        'python',
        '/app/code.py',
      ];

      const proc = spawn('docker', args);
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      proc.stdout.on('data', (data: Buffer) => {
        if (stdout.length < 65536) stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        if (stderr.length < 65536) stderr += data.toString();
      });

      const killTimer = setTimeout(
        () => {
          timedOut = true;
          proc.kill('SIGKILL');
        },
        (timeoutSeconds + 5) * 1000,
      );

      proc.on('close', (exitCode) => {
        clearTimeout(killTimer);
        if (exitCode === 124) timedOut = true;
        resolve({
          stdout: sanitizeOutput(stdout),
          stderr: sanitizeOutput(stderr),
          exitCode: exitCode ?? 1,
          durationMs: Date.now() - start,
          timedOut,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(killTimer);
        resolve({
          stdout: '',
          stderr: sanitizeOutput(err.message),
          exitCode: 1,
          durationMs: Date.now() - start,
          timedOut: false,
          infrastructureError: true,
        });
      });
    });
  } finally {
    await rm(codeDir, { recursive: true, force: true }).catch((err) => {
      logger.warn({ dir: codeDir, error: String(err) }, 'Failed to clean up temp code dir');
    });
  }
}
