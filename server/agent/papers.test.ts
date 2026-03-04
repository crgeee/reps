import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: {} }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }));

import { isBlockedHost } from './papers.js';

describe('isBlockedHost', () => {
  it.each([
    ['localhost', true],
    ['127.0.0.1', true],
    ['10.0.0.1', true],
    ['192.168.1.1', true],
    ['169.254.169.254', true],
    ['172.16.0.1', true],
    ['172.31.0.1', true],
    ['foo.local', true],
    ['metadata.google.internal', true],
    ['0x7f000001', true],
    ['0177.0.0.1', true],
    ['::ffff:127.0.0.1', true],
    ['[::1]', true],
    ['0.0.0.0', true],
    ['172.32.0.1', false],
    ['example.com', false],
    ['arxiv.org', false],
  ])('%s => %s', (host, expected) => {
    expect(isBlockedHost(host)).toBe(expected);
  });
});
