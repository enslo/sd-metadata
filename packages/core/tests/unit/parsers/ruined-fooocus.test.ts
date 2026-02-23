import { describe, expect, it } from 'vitest';
import { parseRuinedFooocus } from '../../../src/parsers/ruined-fooocus';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create Ruined Fooocus metadata entry
 */
function createRuinedFooocusEntry(metadata: unknown): EntryRecord {
  return { parameters: JSON.stringify(metadata) };
}

describe('parseRuinedFooocus - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: EntryRecord = {};

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for non-JSON parameters', () => {
      const entries: EntryRecord = { parameters: 'plain text' };

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: EntryRecord = { parameters: '{invalid json}' };

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal Ruined Fooocus metadata', () => {
      const metadata = {
        software: 'RuinedFooocus',
        Prompt: 'a beautiful landscape',
        Negative: 'lowres, bad quality',
      };
      const entries = createRuinedFooocusEntry(metadata);

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('ruined-fooocus');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract dimensions', () => {
      const metadata = {
        software: 'RuinedFooocus',
        Prompt: 'test',
        width: 512,
        height: 768,
      };
      const entries = createRuinedFooocusEntry(metadata);

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling settings', () => {
      const metadata = {
        software: 'RuinedFooocus',
        Prompt: 'test',
        seed: 123456,
        steps: 30,
        cfg: 7.5,
        sampler_name: 'euler_a',
        scheduler: 'normal',
        clip_skip: 2,
      };
      const entries = createRuinedFooocusEntry(metadata);

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: 123456,
          steps: 30,
          cfg: 7.5,
          sampler: 'euler_a',
          scheduler: 'normal',
          clipSkip: 2,
        });
      }
    });

    it('should extract model settings', () => {
      const metadata = {
        software: 'RuinedFooocus',
        Prompt: 'test',
        base_model_name: 'test-model.safetensors',
        base_model_hash: 'abc123',
      };
      const entries = createRuinedFooocusEntry(metadata);

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'test-model.safetensors',
          hash: 'abc123',
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should trim prompt whitespace', () => {
      const metadata = {
        software: 'RuinedFooocus',
        Prompt: '  test prompt  ',
        Negative: '  negative  ',
      };
      const entries = createRuinedFooocusEntry(metadata);

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test prompt');
        expect(result.value.negativePrompt).toBe('negative');
      }
    });

    it('should handle missing prompts', () => {
      const metadata = {
        software: 'RuinedFooocus',
      };
      const entries = createRuinedFooocusEntry(metadata);

      const result = parseRuinedFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });
  });
});
