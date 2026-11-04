import { describe, expect, it } from 'vitest';
import { parseNumberText, toNumber } from '../../../src/utils/number';

describe('toNumber', () => {
  it('keeps finite numbers and drops the rest', () => {
    expect(toNumber(7)).toBe(7);
    expect(toNumber(0.35)).toBe(0.35);
    expect(toNumber(Number.NaN)).toBeUndefined();
    expect(toNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('reads numbers written as text', () => {
    expect(toNumber('20')).toBe(20);
    expect(toNumber(' 0.8 ')).toBe(0.8);
    expect(toNumber('')).toBeUndefined();
    expect(toNumber('Euler a')).toBeUndefined();
  });

  it('ignores other values', () => {
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber(undefined)).toBeUndefined();
    expect(toNumber(['5', 0])).toBeUndefined();
    expect(toNumber(true)).toBeUndefined();
  });
});

describe('parseNumberText', () => {
  it('parses trimmed text and rejects blanks', () => {
    expect(parseNumberText('1.5')).toBe(1.5);
    expect(parseNumberText('  -0.72 ')).toBe(-0.72);
    expect(parseNumberText('   ')).toBeUndefined();
    expect(parseNumberText(undefined)).toBeUndefined();
    expect(parseNumberText('abc')).toBeUndefined();
  });
});
