import { describe, expect, it } from 'vitest';
import { parseTensorArt } from '../../../src/parsers/tensorart';
import type { MetadataEntry } from '../../../src/types';

/**
 * Helper to create TensorArt metadata entries
 */
function createTensorArtEntries(generationData: unknown): MetadataEntry[] {
  const entries: MetadataEntry[] = [
    { keyword: 'generation_data', text: JSON.stringify(generationData) },
    {
      keyword: 'prompt',
      text: JSON.stringify({ '1': { class_type: 'KSampler', inputs: {} } }),
    },
  ];
  return entries;
}

describe('parseTensorArt - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing generation_data', () => {
      const entries: MetadataEntry[] = [];

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries = [{ keyword: 'generation_data', text: 'not valid json' }];

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal TensorArt metadata', () => {
      const data = {
        prompt: 'a beautiful landscape',
        negativePrompt: 'lowres, bad quality',
      };
      const entries = createTensorArtEntries(data);

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('tensorart');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract dimensions', () => {
      const data = {
        prompt: 'test',
        width: 512,
        height: 768,
      };
      const entries = createTensorArtEntries(data);

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling settings', () => {
      const data = {
        prompt: 'test',
        seed: '123456',
        steps: 30,
        cfgScale: 7.5,
        clipSkip: 2,
      };
      const entries = createTensorArtEntries(data);

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: 123456,
          steps: 30,
          cfg: 7.5,
          clipSkip: 2,
        });
      }
    });

    it('should extract model settings', () => {
      const data = {
        prompt: 'test',
        baseModel: {
          modelFileName: 'test-model.safetensors',
          hash: 'abc123',
        },
      };
      const entries = createTensorArtEntries(data);

      const result = parseTensorArt(entries);

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
    it('should handle missing optional fields', () => {
      const data = { prompt: 'test' };
      const entries = createTensorArtEntries(data);

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.software === 'tensorart') {
        expect(result.value.prompt).toBe('test');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
        expect(result.value.sampling).toBeUndefined();
        expect(result.value.model).toBeUndefined();
      }
    });

    it('should handle NUL-terminated JSON', () => {
      // TensorArt appends NUL characters
      const data = { prompt: 'test' };
      const jsonWithNul = `${JSON.stringify(data)}\x00\x00\x00`;
      const entries = [
        { keyword: 'generation_data', text: jsonWithNul },
        {
          keyword: 'prompt',
          text: JSON.stringify({ '1': { class_type: 'KSampler', inputs: {} } }),
        },
      ];

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
      }
    });
  });
});
