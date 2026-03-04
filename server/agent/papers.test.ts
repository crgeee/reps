import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: {} }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }));

import { isBlockedHost } from './papers.js';

describe('isBlockedHost', () => {
  it('blocks localhost', () => {
    expect(isBlockedHost('localhost')).toBe(true);
  });

  it('blocks 127.0.0.1', () => {
    expect(isBlockedHost('127.0.0.1')).toBe(true);
  });

  it('blocks 10.x.x.x', () => {
    expect(isBlockedHost('10.0.0.1')).toBe(true);
  });

  it('blocks 192.168.x.x', () => {
    expect(isBlockedHost('192.168.1.1')).toBe(true);
  });

  it('blocks 169.254.x.x (link-local)', () => {
    expect(isBlockedHost('169.254.169.254')).toBe(true);
  });

  it('blocks 172.16.0.1 (inside /12 range)', () => {
    expect(isBlockedHost('172.16.0.1')).toBe(true);
  });

  it('allows 172.32.0.1 (outside /12 range)', () => {
    expect(isBlockedHost('172.32.0.1')).toBe(false);
  });

  it('allows example.com', () => {
    expect(isBlockedHost('example.com')).toBe(false);
  });

  it('allows arxiv.org', () => {
    expect(isBlockedHost('arxiv.org')).toBe(false);
  });

  it('blocks foo.local', () => {
    expect(isBlockedHost('foo.local')).toBe(true);
  });

  it('blocks metadata.google.internal', () => {
    expect(isBlockedHost('metadata.google.internal')).toBe(true);
  });

  it('blocks hex-encoded 0x7f000001', () => {
    expect(isBlockedHost('0x7f000001')).toBe(true);
  });

  it('blocks IPv6-mapped ::ffff:127.0.0.1', () => {
    expect(isBlockedHost('::ffff:127.0.0.1')).toBe(true);
  });

  it('blocks [::1]', () => {
    expect(isBlockedHost('[::1]')).toBe(true);
  });

  it('blocks 0.0.0.0', () => {
    expect(isBlockedHost('0.0.0.0')).toBe(true);
  });
});
