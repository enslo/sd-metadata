import { describe, expect, it } from 'vitest';
import { parseDrawThings } from '../../../src/parsers/draw-things';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create Draw Things entries with UserComment JSON
 */
function createEntries(
  json: Record<string, unknown>,
  overrides: Record<string, string> = {},
): EntryRecord {
  return {
    CreatorTool: 'Draw Things',
    UserComment: JSON.stringify(json),
    ...overrides,
  };
}

/** Minimal valid Draw Things JSON */
const minimalJson = {
  c: 'a beautiful landscape',
  uc: 'blurry, ugly',
  model: 'sd-v1-5.safetensors',
  sampler: 'DPM++ 2M AYS',
  scale: 7.5,
  seed: 12345,
  steps: 20,
  strength: 0.75,
  size: '512x768',
};

describe('parseDrawThings - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for empty entries', () => {
      const entries: EntryRecord = {};

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for non-JSON UserComment', () => {
      const entries: EntryRecord = { UserComment: 'plain text' };

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON in UserComment', () => {
      const entries: EntryRecord = { UserComment: '{invalid json}' };

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('field extraction', () => {
    it('should parse basic fields', () => {
      const entries = createEntries(minimalJson);

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('draw-things');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('blurry, ugly');
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract model name', () => {
      const entries = createEntries(minimalJson);

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model?.name).toBe('sd-v1-5.safetensors');
      }
    });

    it('should extract sampling settings', () => {
      const entries = createEntries(minimalJson);

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toEqual({
          sampler: 'DPM++ 2M AYS',
          steps: 20,
          cfg: 7.5,
          seed: 12345,
          denoise: 0.75,
        });
      }
    });

    it('should parse size string into width and height', () => {
      const entries = createEntries({ ...minimalJson, size: '1024x1024' });

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(1024);
        expect(result.value.height).toBe(1024);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const entries = createEntries({ c: 'test', uc: '' });

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });

    it('should trim prompt whitespace', () => {
      const entries = createEntries({
        ...minimalJson,
        c: '  landscape  ',
        uc: '  blurry  ',
      });

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('landscape');
        expect(result.value.negativePrompt).toBe('blurry');
      }
    });

    it('should handle invalid size format', () => {
      const entries = createEntries({ ...minimalJson, size: 'invalid' });

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });

    it('should not include zero-value numeric fields in sampling', () => {
      const entries = createEntries({
        c: 'test',
        uc: '',
        scale: 0,
        seed: 0,
        steps: 0,
      });

      const result = parseDrawThings(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling?.cfg).toBeUndefined();
        expect(result.value.sampling?.seed).toBeUndefined();
        expect(result.value.sampling?.steps).toBeUndefined();
      }
    });
  });
});
