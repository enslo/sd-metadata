import { describe, expect, it } from 'vitest';
import { parseTensorArt } from '../../../src/parsers/tensorart';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create TensorArt metadata entries
 *
 * Builds a minimal but realistic ComfyUI node graph alongside generation_data.
 */
function createTensorArtEntries(
  generationData: unknown,
  nodeOverrides?: Record<string, unknown>,
): EntryRecord {
  const defaultNodes = { '1': { class_type: 'KSampler', inputs: {} } };
  return {
    generation_data: JSON.stringify(generationData),
    prompt: JSON.stringify({ ...defaultNodes, ...nodeOverrides }),
  };
}

describe('parseTensorArt - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing generation_data', () => {
      const entries: EntryRecord = {};

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: EntryRecord = { generation_data: 'not valid json' };

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

    it('should extract dimensions from nodes', () => {
      const data = { prompt: 'test' };
      const entries = createTensorArtEntries(data, {
        '10': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 512, height: 768, batch_size: 1 },
        },
      });

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling from nodes', () => {
      const data = { prompt: 'test' };
      const entries = createTensorArtEntries(data, {
        '1': {
          class_type: 'KSampler',
          inputs: {
            seed: 123456,
            steps: 30,
            cfg: 7.5,
            sampler_name: 'euler',
            scheduler: 'normal',
          },
        },
        '2': {
          class_type: 'CLIPSetLastLayer',
          inputs: { stop_at_clip_layer: -2 },
        },
      });

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: 123456,
          steps: 30,
          cfg: 7.5,
          sampler: 'euler',
          scheduler: 'normal',
          clipSkip: 2,
        });
      }
    });

    it('should extract model from generation_data', () => {
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

  describe('delegation to ComfyUI parser', () => {
    it('should prefer prompt from generation_data over nodes', () => {
      const data = { prompt: 'from generation_data' };
      const entries = createTensorArtEntries(data);

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('from generation_data');
      }
    });

    it('should prefer model from generation_data over nodes', () => {
      const data = {
        prompt: 'test',
        baseModel: {
          modelFileName: 'tensorart-model.safetensors',
          hash: 'TA_HASH',
        },
      };
      const entries = createTensorArtEntries(data, {
        '5': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'comfyui-model.safetensors' },
        },
      });

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'tensorart-model.safetensors',
          hash: 'TA_HASH',
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
      const entries: EntryRecord = {
        generation_data: jsonWithNul,
        prompt: JSON.stringify({ '1': { class_type: 'KSampler', inputs: {} } }),
      };

      const result = parseTensorArt(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
      }
    });
  });
});
