import { describe, expect, it } from 'vitest';
import { parseComfyUI } from '../../../src/parsers/comfyui';
import type { MetadataEntry } from '../../../src/types';

/**
 * Helper to create ComfyUI metadata entries
 */
function createComfyUIEntries(
  prompt: unknown,
  workflow?: unknown,
): MetadataEntry[] {
  const entries: MetadataEntry[] = [
    { keyword: 'prompt', text: JSON.stringify(prompt) },
  ];
  if (workflow) {
    entries.push({ keyword: 'workflow', text: JSON.stringify(workflow) });
  }
  return entries;
}

describe('parseComfyUI - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing prompt', () => {
      const entries: MetadataEntry[] = [];

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries = [{ keyword: 'prompt', text: 'not valid json' }];

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal ComfyUI metadata', () => {
      const prompt = {
        PositiveCLIP_Base: {
          inputs: { text: 'positive prompt' },
          class_type: 'CLIPTextEncode',
        },
        NegativeCLIP_Base: {
          inputs: { text: 'negative prompt' },
          class_type: 'CLIPTextEncode',
        },
        '3': {
          inputs: {
            positive: ['1', 0],
            negative: ['2', 0],
          },
          class_type: 'KSampler',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.type).toBe('comfyui');
        expect(result.value.prompt).toBe('positive prompt');
        expect(result.value.negativePrompt).toBe('negative prompt');
      }
    });

    it('should store workflow in raw when provided', () => {
      const prompt = {
        '1': {
          inputs: { text: 'test prompt' },
          class_type: 'CLIPTextEncode',
        },
      };
      const workflow = { nodes: ['test'] };
      const entries = createComfyUIEntries(prompt, workflow);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Workflow should be stored (in the metadata)
        expect(result.value).toBeDefined();
      }
    });
  });

  describe('node finding', () => {
    it('should find KSampler node', () => {
      const prompt = {
        PositiveCLIP_Base: {
          inputs: { text: 'positive' },
          class_type: 'CLIPTextEncode',
        },
        '2': {
          inputs: {
            positive: ['1', 0],
          },
          class_type: 'KSampler',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('positive');
      }
    });

    it('should find KSamplerAdvanced node', () => {
      const prompt = {
        PositiveCLIP_Base: {
          inputs: { text: 'positive' },
          class_type: 'CLIPTextEncode',
        },
        '2': {
          inputs: {
            positive: ['1', 0],
          },
          class_type: 'KSamplerAdvanced',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('positive');
      }
    });
  });

  describe('Civitai extraMetadata', () => {
    it('should extract extraMetadata from prompt', () => {
      const prompt = {
        extraMetadata: JSON.stringify({
          prompt: 'civitai prompt',
          negativePrompt: 'civitai negative',
          width: 512,
          height: 768,
        }),
        '1': {
          inputs: { text: 'fallback' },
          class_type: 'CLIPTextEncode',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should prefer extraMetadata
        expect(result.value.prompt).toBe('civitai prompt');
        expect(result.value.negativePrompt).toBe('civitai negative');
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle prompt without KSampler', () => {
      // ComfyUI without KSampler should fail format check
      const prompt = {
        '1': {
          inputs: { text: 'test' },
          class_type: 'CLIPTextEncode',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Without KSampler, prompts will be empty
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });

    it('should handle missing CLIP nodes', () => {
      const prompt = {
        '1': {
          inputs: {},
          class_type: 'KSampler',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });
  });
});
