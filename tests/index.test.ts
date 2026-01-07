import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/index';

describe('sd-metadata', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
