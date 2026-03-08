import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

import { ExecutionQueue, CircuitBreaker, sanitizeOutput } from './docker-runner.js';

describe('ExecutionQueue', () => {
  let queue: ExecutionQueue;

  beforeEach(() => {
    queue = new ExecutionQueue({ maxConcurrent: 1 });
  });

  it('tracks active execution count', () => {
    expect(queue.activeCount).toBe(0);
  });

  it('reports isBusy when at max concurrent', () => {
    expect(queue.isBusy).toBe(false);
    queue.acquire();
    expect(queue.isBusy).toBe(true);
  });

  it('releases slots', () => {
    queue.acquire();
    queue.release();
    expect(queue.isBusy).toBe(false);
  });

  it('rejects acquire when busy', () => {
    expect(queue.acquire()).toBe(true);
    expect(queue.acquire()).toBe(false);
  });
});

describe('CircuitBreaker', () => {
  it('opens after consecutive failures', () => {
    const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 1000 });
    expect(breaker.isOpen).toBe(false);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen).toBe(true);
  });

  it('resets on success', () => {
    const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 1000 });
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    expect(breaker.isOpen).toBe(false);
  });

  it('stays closed before threshold', () => {
    const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 1000 });
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen).toBe(false);
  });
});

describe('sanitizeOutput', () => {
  it('escapes HTML entities', () => {
    expect(sanitizeOutput('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('truncates output exceeding max length', () => {
    const long = 'a'.repeat(70000);
    const result = sanitizeOutput(long, 65536);
    expect(result.length).toBeLessThanOrEqual(65536 + 50);
    expect(result).toContain('[truncated]');
  });

  it('does not truncate short output', () => {
    expect(sanitizeOutput('hello')).toBe('hello');
  });
});
