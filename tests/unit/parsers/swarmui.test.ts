import { describe, expect, it } from 'vitest';
import { parseSwarmUI } from '../../../src/parsers/swarmui';
import type { MetadataEntry } from '../../../src/types';

/**
 * Helper to create SwarmUI parameters entry
 */
function createSwarmUIEntries(params: unknown): MetadataEntry[] {
  return [{ keyword: 'parameters', text: JSON.stringify(params) }];
}

describe('parseSwarmUI - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: MetadataEntry[] = [];

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries = [{ keyword: 'parameters', text: 'not valid json' }];

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });

    it('should return error for missing sui_image_params', () => {
      const params = { other: 'data' };
      const entries = createSwarmUIEntries(params);

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal SwarmUI metadata', () => {
      const params = {
        sui_image_params: {
          prompt: 'a beautiful landscape',
          negativeprompt: 'lowres, bad quality',
        },
      };
      const entries = createSwarmUIEntries(params);

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('swarmui');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract dimensions', () => {
      const params = {
        sui_image_params: {
          prompt: 'test',
          width: 512,
          height: 768,
        },
      };
      const entries = createSwarmUIEntries(params);

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling settings', () => {
      const params = {
        sui_image_params: {
          prompt: 'test',
          seed: 123456,
          steps: 25,
          cfgscale: 7.5,
          sampler: 'euler',
          scheduler: 'normal',
        },
      };
      const entries = createSwarmUIEntries(params);

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: 123456,
          steps: 25,
          cfg: 7.5,
          sampler: 'euler',
          scheduler: 'normal',
        });
      }
    });

    it('should extract model settings', () => {
      const params = {
        sui_image_params: {
          prompt: 'test',
          model: 'stable-diffusion-v1-5',
        },
      };
      const entries = createSwarmUIEntries(params);

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'stable-diffusion-v1-5',
        });
      }
    });

    it('should extract hires/upscale settings', () => {
      const params = {
        sui_image_params: {
          prompt: 'test',
          refinerupscale: 2,
          refinerupscalemethod: 'Latent',
          refinercontrolpercentage: 0.5,
        },
      };
      const entries = createSwarmUIEntries(params);

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hires).toMatchObject({
          scale: 2,
          upscaler: 'Latent',
          denoise: 0.5,
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const params = {
        sui_image_params: {
          prompt: 'test',
        },
      };
      const entries = createSwarmUIEntries(params);

      const result = parseSwarmUI(entries);

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

    it('should handle UserComment entry instead of parameters', () => {
      const params = {
        sui_image_params: {
          prompt: 'test',
        },
      };
      const entries = [
        { keyword: 'UserComment', text: JSON.stringify(params) },
      ];

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
      }
    });
  });
});
