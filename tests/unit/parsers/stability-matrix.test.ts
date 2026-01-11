import { describe, expect, it } from 'vitest';
import { parseStabilityMatrix } from '../../../src/parsers/stability-matrix';
import type { MetadataEntry } from '../../../src/types';

/**
 * Helper to create StabilityMatrix entries
 */
function createStabilityMatrixEntries(
  json: unknown,
  workflow?: unknown,
): MetadataEntry[] {
  const entries: MetadataEntry[] = [
    { keyword: 'parameters-json', text: JSON.stringify(json) },
  ];
  if (workflow) {
    entries.push({ keyword: 'prompt', text: JSON.stringify(workflow) });
  }
  return entries;
}

describe('parseStabilityMatrix - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters-json', () => {
      const entries: MetadataEntry[] = [];

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries = [{ keyword: 'parameters-json', text: 'not valid json' }];

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal Stability Matrix metadata', () => {
      const json = {
        PositivePrompt: 'a beautiful landscape',
        NegativePrompt: 'lowres, bad quality',
      };
      const entries = createStabilityMatrixEntries(json);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('stability-matrix');
        expect(result.value.type).toBe('comfyui');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract dimensions', () => {
      const json = {
        PositivePrompt: 'test',
        Width: 512,
        Height: 768,
      };
      const entries = createStabilityMatrixEntries(json);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract sampling settings', () => {
      const json = {
        PositivePrompt: 'test',
        Seed: 123456,
        Steps: 20,
        CfgScale: 7.5,
        Sampler: 'Euler a',
      };
      const entries = createStabilityMatrixEntries(json);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: 123456,
          steps: 20,
          cfg: 7.5,
          sampler: 'Euler a',
        });
      }
    });

    it('should extract model settings', () => {
      const json = {
        PositivePrompt: 'test',
        ModelName: 'sd-v1-5.safetensors',
        ModelHash: 'abc123',
      };
      const entries = createStabilityMatrixEntries(json);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'sd-v1-5.safetensors',
          hash: 'abc123',
        });
      }
    });

    it('should extract ComfyUI workflow', () => {
      const json = { PositivePrompt: 'test' };
      const workflow = { nodes: ['test'] };
      const entries = createStabilityMatrixEntries(json, workflow);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.type === 'comfyui') {
        expect(result.value.workflow).toEqual({ nodes: ['test'] });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const json = { PositivePrompt: 'test' };
      const entries = createStabilityMatrixEntries(json);

      const result = parseStabilityMatrix(entries);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.type === 'comfyui') {
        expect(result.value.prompt).toBe('test');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
        expect(result.value.sampling).toBeUndefined();
        expect(result.value.model).toBeUndefined();
        expect(result.value.workflow).toBeUndefined();
      }
    });
  });
});
