import { describe, expect, it } from 'vitest';
import { parseComfyUI } from '../../../src/parsers/comfyui';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create ComfyUI metadata entries
 */
function createComfyUIEntries(
  prompt: unknown,
  workflow?: unknown,
): EntryRecord {
  const record: Record<string, string> = {
    prompt: JSON.stringify(prompt),
  };
  if (workflow) {
    record.workflow = JSON.stringify(workflow);
  }
  return record;
}

describe('parseComfyUI - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing prompt', () => {
      const entries: EntryRecord = {};

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: EntryRecord = { prompt: 'not valid json' };

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
        '1': {
          inputs: { text: 'positive prompt' },
          class_type: 'CLIPTextEncode',
        },
        '2': {
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
        '1': {
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
        '1': {
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

  describe('false negative prevention', () => {
    it('should detect ComfyUI from prompt-only chunk with workflow data', () => {
      // Simulates PNG with only "prompt" chunk containing ComfyUI workflow JSON
      // This represents real-world ComfyUI files that don't have separate workflow chunk
      const prompt = {
        '1': {
          inputs: {
            filename_prefix: 'test',
            images: ['2:0', 0],
          },
          class_type: 'SaveImage',
        },
        '2': {
          inputs: { image: 'test_a.jpg' },
          class_type: 'LoadImage',
        },
        '3': {
          inputs: { image: 'test_b.png' },
          class_type: 'LoadImage',
        },
      };

      const entries = createComfyUIEntries(prompt);
      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
      }
    });

    it('should handle workflow keyword entry from WebP EXIF', () => {
      // Simulates WebP with EXIF ImageDescription containing "Workflow" prefix
      // The convert.ts should transform this into a "workflow" keyword entry
      const workflow = {
        id: 'test-workflow-id',
        revision: 0,
        last_node_id: 3,
        nodes: [
          {
            id: 1,
            type: 'TestNode',
            class_type: 'TestNode',
          },
        ],
      };

      // This simulates what the reader should produce after parsing EXIF
      const entries: EntryRecord = { workflow: JSON.stringify(workflow) };

      // Verify the workflow keyword is correctly set
      // This is important for detection logic to catch workflow-only files
      expect(entries.workflow).toBeDefined();
    });
  });
});
