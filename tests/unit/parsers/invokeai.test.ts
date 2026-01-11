import { describe, expect, it } from 'vitest';
import { parseInvokeAI } from '../../../src/parsers/invokeai';
import type { MetadataEntry } from '../../../src/types';

/**
 * Helper to create InvokeAI metadata entries
 */
function createInvokeAIEntries(metadataJson: string): MetadataEntry[] {
  return [{ keyword: 'invokeai_metadata', text: metadataJson }];
}

describe('parseInvokeAI - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing invokeai_metadata', () => {
      const entries: MetadataEntry[] = [];

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries = createInvokeAIEntries('not valid json');

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal InvokeAI metadata', () => {
      const metadata = JSON.stringify({
        positive_prompt: 'a beautiful landscape',
        negative_prompt: 'lowres, bad quality',
      });
      const entries = createInvokeAIEntries(metadata);

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('invokeai');
        expect(result.value.type).toBe('invokeai');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract dimensions', () => {
      const metadata = JSON.stringify({
        positive_prompt: 'test',
        width: 512,
        height: 768,
      });
      const entries = createInvokeAIEntries(metadata);

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling settings', () => {
      const metadata = JSON.stringify({
        positive_prompt: 'test',
        steps: 50,
        cfg_scale: 7.5,
        seed: 123456,
        scheduler: 'euler',
      });
      const entries = createInvokeAIEntries(metadata);

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          steps: 50,
          cfg: 7.5,
          seed: 123456,
          sampler: 'euler',
        });
      }
    });

    it('should extract model settings', () => {
      const metadata = JSON.stringify({
        positive_prompt: 'test',
        model: {
          name: 'stable-diffusion-v1-5',
          hash: 'abc123',
        },
      });
      const entries = createInvokeAIEntries(metadata);

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'stable-diffusion-v1-5',
          hash: 'abc123',
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const metadata = JSON.stringify({
        positive_prompt: 'test',
      });
      const entries = createInvokeAIEntries(metadata);

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
        expect(result.value.sampling).toBeUndefined();
        expect(result.value.model).toBeUndefined();
      }
    });

    it('should handle empty prompts', () => {
      const metadata = JSON.stringify({
        positive_prompt: '',
        negative_prompt: '',
      });
      const entries = createInvokeAIEntries(metadata);

      const result = parseInvokeAI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });
  });
});
