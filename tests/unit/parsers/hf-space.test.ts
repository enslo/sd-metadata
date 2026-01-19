import { describe, expect, it } from 'vitest';
import { parseHfSpace } from '../../../src/parsers/hf-space';
import type { MetadataEntry } from '../../../src/types';

/**
 * Helper to create HF-Space parameters entry
 */
function createHfSpaceEntry(json: unknown): MetadataEntry[] {
  return [{ keyword: 'parameters', text: JSON.stringify(json) }];
}

describe('parseHfSpace - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: MetadataEntry[] = [];

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: MetadataEntry[] = [
        { keyword: 'parameters', text: 'not a json' },
      ];

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });

    it('should return error for malformed JSON', () => {
      const entries: MetadataEntry[] = [
        { keyword: 'parameters', text: '{"prompt": "test"' }, // Missing closing brace
      ];

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal HF-Space metadata', () => {
      const metadata = {
        prompt: 'a beautiful landscape',
        resolution: '512 x 768',
      };
      const entries = createHfSpaceEntry(metadata);

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('hf-space');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should parse with negative prompt', () => {
      const metadata = {
        prompt: 'beautiful scene',
        negative_prompt: 'ugly, distorted',
        resolution: '1024 x 768',
      };
      const entries = createHfSpaceEntry(metadata);

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('beautiful scene');
        expect(result.value.negativePrompt).toBe('ugly, distorted');
      }
    });

    it('should extract model information', () => {
      const metadata = {
        prompt: 'test',
        resolution: '512 x 512',
        Model: 'stable-diffusion-v1-5',
        'Model hash': 'abc123',
      };
      const entries = createHfSpaceEntry(metadata);

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'stable-diffusion-v1-5',
          hash: 'abc123',
        });
      }
    });

    it('should extract sampling settings', () => {
      const metadata = {
        prompt: 'test',
        resolution: '512 x 512',
        sampler: 'Euler a',
        num_inference_steps: 30,
        guidance_scale: 7.5,
        seed: 42,
      };
      const entries = createHfSpaceEntry(metadata);

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          sampler: 'Euler a',
          steps: 30,
          cfg: 7.5,
          seed: 42,
        });
      }
    });
  });

  describe('resolution parsing', () => {
    it('should parse resolution in various formats', () => {
      // Test with spaces
      const withSpaces = createHfSpaceEntry({
        prompt: 'test',
        resolution: '832 x 1216',
      });
      const resultSpaces = parseHfSpace(withSpaces);
      expect(resultSpaces.ok).toBe(true);
      if (resultSpaces.ok) {
        expect(resultSpaces.value.width).toBe(832);
        expect(resultSpaces.value.height).toBe(1216);
      }

      // Test without spaces
      const withoutSpaces = createHfSpaceEntry({
        prompt: 'test',
        resolution: '1024x768',
      });
      const resultNoSpaces = parseHfSpace(withoutSpaces);
      expect(resultNoSpaces.ok).toBe(true);
      if (resultNoSpaces.ok) {
        expect(resultNoSpaces.value.width).toBe(1024);
        expect(resultNoSpaces.value.height).toBe(768);
      }

      // Test with multiple spaces
      const multiSpaces = createHfSpaceEntry({
        prompt: 'test',
        resolution: '512   x   512',
      });
      const resultMulti = parseHfSpace(multiSpaces);
      expect(resultMulti.ok).toBe(true);
      if (resultMulti.ok) {
        expect(resultMulti.value.width).toBe(512);
        expect(resultMulti.value.height).toBe(512);
      }
    });

    it('should default to 0x0 for invalid resolution', () => {
      // Missing resolution
      const missing = createHfSpaceEntry({ prompt: 'test' });
      const resultMissing = parseHfSpace(missing);
      expect(resultMissing.ok).toBe(true);
      if (resultMissing.ok) {
        expect(resultMissing.value.width).toBe(0);
        expect(resultMissing.value.height).toBe(0);
      }

      // Invalid format
      const invalid = createHfSpaceEntry({
        prompt: 'test',
        resolution: 'invalid',
      });
      const resultInvalid = parseHfSpace(invalid);
      expect(resultInvalid.ok).toBe(true);
      if (resultInvalid.ok) {
        expect(resultInvalid.value.width).toBe(0);
        expect(resultInvalid.value.height).toBe(0);
      }

      // Partial resolution
      const partial = createHfSpaceEntry({
        prompt: 'test',
        resolution: '512',
      });
      const resultPartial = parseHfSpace(partial);
      expect(resultPartial.ok).toBe(true);
      if (resultPartial.ok) {
        expect(resultPartial.value.width).toBe(0);
        expect(resultPartial.value.height).toBe(0);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const metadata = {
        prompt: 'test',
        // No resolution, model, or sampling fields
      };
      const entries = createHfSpaceEntry(metadata);

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
        expect(result.value.model?.name).toBeUndefined();
        expect(result.value.model?.hash).toBeUndefined();
        expect(result.value.sampling?.sampler).toBeUndefined();
        expect(result.value.sampling?.steps).toBeUndefined();
        expect(result.value.sampling?.cfg).toBeUndefined();
        expect(result.value.sampling?.seed).toBeUndefined();
      }
    });

    it('should handle null values', () => {
      const metadata = {
        prompt: null,
        negative_prompt: null,
        resolution: null,
      };
      const entries = createHfSpaceEntry(metadata);

      const result = parseHfSpace(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });
  });
});
