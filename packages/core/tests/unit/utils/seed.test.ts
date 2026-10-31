import { describe, expect, it } from 'vitest';
import { toSeedString } from '../../../src/utils/seed';

describe('toSeedString', () => {
  it('should keep a 64-bit seed string exact (beyond Number.MAX_SAFE_INTEGER)', () => {
    expect(toSeedString('7100816951239959675')).toBe('7100816951239959675');
    expect(toSeedString('4575475577937763433')).toBe('4575475577937763433');
  });

  it('should stringify JSON numbers', () => {
    expect(toSeedString(12345)).toBe('12345');
    expect(toSeedString(0)).toBe('0');
    expect(toSeedString(-1)).toBe('-1');
  });

  it('should trim string seeds', () => {
    expect(toSeedString('  42  ')).toBe('42');
  });

  it('should return undefined for empty, missing, and non-finite values', () => {
    expect(toSeedString('')).toBeUndefined();
    expect(toSeedString('   ')).toBeUndefined();
    expect(toSeedString(undefined)).toBeUndefined();
    expect(toSeedString(null)).toBeUndefined();
    expect(toSeedString(Number.NaN)).toBeUndefined();
    expect(toSeedString(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('should ignore node references and other objects', () => {
    expect(toSeedString(['12', 0])).toBeUndefined();
    expect(toSeedString({ seed: 1 })).toBeUndefined();
    expect(toSeedString(true)).toBeUndefined();
  });
});
