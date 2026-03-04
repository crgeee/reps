import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: {} }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }));

import { clampScore } from './evaluator.js';

describe('clampScore', () => {
  it('returns value within range as-is', () => {
    expect(clampScore(3)).toBe(3);
  });

  it('clamps below min to 1', () => {
    expect(clampScore(0)).toBe(1);
  });

  it('clamps above max to 5', () => {
    expect(clampScore(6)).toBe(5);
  });

  it('returns 3 for NaN', () => {
    expect(clampScore(NaN)).toBe(3);
  });

  it('returns 3 for undefined', () => {
    expect(clampScore(undefined)).toBe(3);
  });

  it('rounds 2.7 to 3', () => {
    expect(clampScore(2.7)).toBe(3);
  });

  it('clamps null (Number(null)=0) to 1', () => {
    expect(clampScore(null)).toBe(1);
  });

  it('handles string numbers', () => {
    expect(clampScore('4')).toBe(4);
  });

  it('clamps negative numbers to 1', () => {
    expect(clampScore(-1)).toBe(1);
  });
});
