import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: {} }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }));

import { clampScore } from './evaluator.js';

describe('clampScore', () => {
  it.each([
    [3, 3, 'value within range'],
    [1, 1, 'min boundary'],
    [5, 5, 'max boundary'],
    [0, 1, 'below min clamps to 1'],
    [6, 5, 'above max clamps to 5'],
    [-1, 1, 'negative clamps to 1'],
    [2.7, 3, 'rounds 2.7 to 3'],
    [NaN, 3, 'NaN defaults to 3'],
    [undefined, 3, 'undefined defaults to 3'],
    [null, 1, 'null (Number(null)=0) clamps to 1'],
    ['4', 4, 'string number coerced'],
  ] as [unknown, number, string][])('clampScore(%s) => %s (%s)', (input, expected) => {
    expect(clampScore(input)).toBe(expected);
  });
});
