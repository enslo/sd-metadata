import { describe, expect, it } from 'vitest';
import { parseSwarmUI } from '../../../src/parsers/swarmui';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create SwarmUI parameters entry
 */
function createSwarmUIEntries(params: unknown): EntryRecord {
  return { parameters: JSON.stringify(params) };
}

describe('parseSwarmUI - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: EntryRecord = {};

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: EntryRecord = { parameters: 'not valid json' };

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
          seed: '123456',
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
      const entries: EntryRecord = { UserComment: JSON.stringify(params) };

      const result = parseSwarmUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
      }
    });
  });
});

describe('parseSwarmUI - LoRA extraction', () => {
  it('should pair loras with loraweights and match hashes from sui_models', () => {
    const entries = createSwarmUIEntries({
      sui_image_params: {
        prompt: 'test',
        loras: ['LECO_BadHands', 'styles/LECO_GoodHands'],
        loraweights: ['-0.5', '0.6'],
      },
      sui_models: [
        { name: 'model.safetensors', param: 'model', hash: '0xaaaa' },
        { name: 'LECO_BadHands.safetensors', param: 'loras', hash: '0xbbbb' },
        {
          name: 'styles/LECO_GoodHands.safetensors',
          param: 'loras',
          hash: '0xcccc',
        },
      ],
    });

    const result = parseSwarmUI(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        { name: 'LECO_BadHands', weight: -0.5, hash: '0xbbbb' },
        { name: 'styles/LECO_GoodHands', weight: 0.6, hash: '0xcccc' },
      ]);
    }
  });

  it('should leave out weights and hashes that are not recorded', () => {
    const entries = createSwarmUIEntries({
      sui_image_params: {
        prompt: 'test',
        loras: ['a', 'b'],
        loraweights: ['0.8'],
      },
    });

    const result = parseSwarmUI(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        { name: 'a', weight: 0.8 },
        { name: 'b' },
      ]);
    }
  });

  it('should omit loras when the list is missing or empty', () => {
    for (const params of [{ prompt: 'test' }, { prompt: 'test', loras: [] }]) {
      const result = parseSwarmUI(
        createSwarmUIEntries({ sui_image_params: params }),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toHaveProperty('loras');
      }
    }
  });
});
