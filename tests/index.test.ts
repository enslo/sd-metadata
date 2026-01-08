import { describe, expect, it } from 'vitest';
import { readPngMetadata } from '../src';

describe('sd-metadata', () => {
  it('should export readPngMetadata', () => {
    expect(typeof readPngMetadata).toBe('function');
  });
});
