import { describe, expect, it } from 'vitest';
import { parseStabilityMatrix } from '../../../src/parsers/stability-matrix';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create ComfyUI workflow entries for testing
 */
function createComfyUIWorkflow(
  prompt: string,
  negativePrompt: string,
  options: {
    width?: number;
    height?: number;
    seed?: number;
    steps?: number;
    cfg?: number;
    sampler?: string;
    modelName?: string;
    modelHash?: string;
  } = {},
): unknown {
  return {
    PositiveCLIP_Base: {
      inputs: { text: prompt },
      class_type: 'CLIPTextEncode',
    },
    NegativeCLIP_Base: {
      inputs: { text: negativePrompt },
      class_type: 'CLIPTextEncode',
    },
    Sampler: {
      inputs: {
        seed: options.seed ?? 0,
        steps: options.steps ?? 20,
        cfg: options.cfg ?? 7,
        sampler_name: options.sampler ?? 'euler',
        positive: ['PositiveCLIP_Base', 0],
        negative: ['NegativeCLIP_Base', 0],
        latent_image: ['EmptyLatentImage', 0],
      },
      class_type: 'KSampler',
    },
    EmptyLatentImage: {
      inputs: {
        width: options.width ?? 512,
        height: options.height ?? 512,
      },
      class_type: 'EmptyLatentImage',
    },
    ...(options.modelName && {
      Checkpoint_Base: {
        inputs: { ckpt_name: options.modelName },
        class_type: 'CheckpointLoaderSimple',
      },
    }),
  };
}

/**
 * Helper to create StabilityMatrix entries
 */
function createStabilityMatrixEntries(
  json: unknown,
  workflow?: unknown,
): EntryRecord {
  const record: Record<string, string> = {};
  if (workflow) {
    record.prompt = JSON.stringify(workflow);
  }
  record['parameters-json'] = JSON.stringify(json);
  return record;
}

describe('parseStabilityMatrix - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing workflow (ComfyUI required)', () => {
      const json = { PositivePrompt: 'test' };
      const entries = createStabilityMatrixEntries(json);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse metadata and override prompts from parameters-json', () => {
      const workflow = createComfyUIWorkflow(
        'workflow prompt',
        'workflow negative',
      );
      const json = {
        PositivePrompt: 'json prompt (more complete)',
        NegativePrompt: 'json negative (more complete)',
      };
      const entries = createStabilityMatrixEntries(json, workflow);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('stability-matrix');
        // Prompts should be from parameters-json (override)
        expect(result.value.prompt).toBe('json prompt (more complete)');
        expect(result.value.negativePrompt).toBe(
          'json negative (more complete)',
        );
      }
    });

    it('should extract dimensions from ComfyUI workflow', () => {
      const workflow = createComfyUIWorkflow('test', 'negative', {
        width: 1024,
        height: 768,
      });
      const json = { PositivePrompt: 'test' };
      const entries = createStabilityMatrixEntries(json, workflow);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(1024);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling settings from ComfyUI workflow', () => {
      const workflow = createComfyUIWorkflow('test', 'negative', {
        seed: 123456,
        steps: 20,
        cfg: 7.5,
        sampler: 'euler_a',
      });
      const json = { PositivePrompt: 'test' };
      const entries = createStabilityMatrixEntries(json, workflow);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: 123456,
          steps: 20,
          cfg: 7.5,
          sampler: 'euler_a',
        });
      }
    });

    it('should override model settings from parameters-json', () => {
      const workflow = createComfyUIWorkflow('test', 'negative', {
        modelName: 'workflow-model.safetensors',
      });
      const json = {
        PositivePrompt: 'test',
        ModelName: 'json-model.safetensors',
        ModelHash: 'json-hash-123',
      };
      const entries = createStabilityMatrixEntries(json, workflow);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Model should be from parameters-json (override)
        expect(result.value.model).toMatchObject({
          name: 'json-model.safetensors',
          hash: 'json-hash-123',
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should use workflow prompts when parameters-json has no prompts', () => {
      const workflow = createComfyUIWorkflow(
        'workflow prompt',
        'workflow negative',
      );
      const json = {}; // No prompts in parameters-json
      const entries = createStabilityMatrixEntries(json, workflow);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.software === 'stability-matrix') {
        // Should use workflow prompts (no override)
        expect(result.value.prompt).toBe('workflow prompt');
        expect(result.value.negativePrompt).toBe('workflow negative');
      }
    });
  });
});
