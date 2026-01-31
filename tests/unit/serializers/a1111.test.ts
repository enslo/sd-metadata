import { describe, expect, it } from 'vitest';
import { parseA1111 } from '../../../src/parsers/a1111';
import { formatAsWebUI } from '../../../src/serializers/a1111';
import type {
  ComfyUIMetadata,
  GenerationMetadata,
  NovelAIMetadata,
  StandardMetadata,
} from '../../../src/types';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to parse A1111 text back to metadata for round-trip tests
 */
function parseA1111Text(text: string): GenerationMetadata | null {
  const entries: EntryRecord = { parameters: text };
  const result = parseA1111(entries);
  return result.ok ? result.value : null;
}

describe('formatAsWebUI - Unit Tests', () => {
  describe('basic serialization', () => {
    it('should serialize minimal metadata', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test prompt',
        negativePrompt: '',
        width: 512,
        height: 768,
      };

      const result = formatAsWebUI(metadata);

      const expected = ['test prompt', 'Size: 512x768'].join('\n');

      expect(result).toBe(expected);
    });

    it('should serialize with negative prompt', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'positive prompt',
        negativePrompt: 'negative prompt',
        width: 512,
        height: 512,
      };

      const result = formatAsWebUI(metadata);

      // Verify exact format and order
      const expected = [
        'positive prompt',
        'Negative prompt: negative prompt',
        'Size: 512x512',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should serialize with all settings', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: 'bad quality',
        width: 512,
        height: 768,
        model: {
          name: 'test-model-v1',
          hash: 'abc123',
        },
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          scheduler: 'Automatic',
          cfg: 7.5,
          seed: 123456,
          clipSkip: 2,
        },
      };

      const result = formatAsWebUI(metadata);

      // Verify exact format and order: prompt, negative, settings
      const expected = [
        'test',
        'Negative prompt: bad quality',
        'Steps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7.5, Seed: 123456, Size: 512x768, Model hash: abc123, Model: test-model-v1, Clip skip: 2',
      ].join('\n');

      expect(result).toBe(expected);
    });
  });

  describe('upscale/hires handling', () => {
    it('should serialize hires settings', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        hires: {
          scale: 2,
          upscaler: 'Latent',
          steps: 10,
          denoise: 0.5,
        },
      };

      const result = formatAsWebUI(metadata);

      // Verify exact settings line format with proper delimiter
      const expected = [
        'test',
        'Size: 512x512, Denoising strength: 0.5, Hires upscale: 2, Hires steps: 10, Hires upscaler: Latent',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should convert upscale to hires format', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        upscale: {
          scale: 2,
          upscaler: 'ESRGAN-4x',
        },
      };

      const result = formatAsWebUI(metadata);

      // Verify exact output: upscale converted to Hires format, no steps/denoise
      const expected = [
        'test',
        'Size: 512x512, Hires upscale: 2, Hires upscaler: ESRGAN-4x',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should prioritize hires over upscale when both exist', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        hires: {
          scale: 1.5,
          upscaler: 'Latent',
          steps: 10,
          denoise: 0.3,
        },
        upscale: {
          scale: 2,
          upscaler: 'ESRGAN-4x',
        },
      };

      const result = formatAsWebUI(metadata);

      // Should use hires values, not upscale
      const expected = [
        'test',
        'Size: 512x512, Denoising strength: 0.3, Hires upscale: 1.5, Hires steps: 10, Hires upscaler: Latent',
      ].join('\n');

      expect(result).toBe(expected);
    });
  });

  describe('NovelAI character prompts', () => {
    it('should serialize NovelAI character prompts as comments', () => {
      const metadata: NovelAIMetadata = {
        software: 'novelai',
        prompt: 'main prompt',
        negativePrompt: 'bad quality',
        width: 1024,
        height: 1024,
        characterPrompts: [
          {
            prompt: 'girl, hatsune miku',
            center: { x: 0.5, y: 0.3 },
          },
          {
            prompt: 'boy, kagamine len',
            center: { x: 0.7, y: 0.7 },
          },
        ],
      };

      const result = formatAsWebUI(metadata);

      // Verify exact format and order: positive -> character -> negative -> settings
      const expected = [
        'main prompt',
        '# Character 1 [0.5, 0.3]:',
        'girl, hatsune miku',
        '# Character 2 [0.7, 0.7]:',
        'boy, kagamine len',
        'Negative prompt: bad quality',
        'Size: 1024x1024',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should handle character prompts without coordinates', () => {
      const metadata: NovelAIMetadata = {
        software: 'novelai',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [
          {
            prompt: 'character without coords',
          },
        ],
      };

      const result = formatAsWebUI(metadata);

      const expected = [
        'test',
        '# Character 1:',
        'character without coords',
        'Size: 512x512',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should skip empty characterPrompts array', () => {
      const metadata: NovelAIMetadata = {
        software: 'novelai',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [],
      };

      const result = formatAsWebUI(metadata);

      const expected = ['test', 'Size: 512x512'].join('\n');

      expect(result).toBe(expected);
      expect(result).not.toContain('# Character');
    });
  });

  describe('ComfyUI handling', () => {
    it('should serialize ComfyUI metadata (ignoring nodes)', () => {
      const metadata: ComfyUIMetadata = {
        software: 'comfyui',
        prompt: 'comfy prompt',
        negativePrompt: 'comfy negative',
        width: 1024,
        height: 1024,
        nodes: {
          '1': {
            class_type: 'KSampler',
            inputs: { seed: 12345, steps: 20 },
          },
        },
        sampling: {
          steps: 20,
          seed: 12345,
        },
      };

      const result = formatAsWebUI(metadata);

      const expected = [
        'comfy prompt',
        'Negative prompt: comfy negative',
        'Steps: 20, Seed: 12345, Size: 1024x1024',
      ].join('\n');

      expect(result).toBe(expected);
      // nodes should be completely ignored
      expect(result).not.toContain('KSampler');
      expect(result).not.toContain('class_type');
    });
  });

  describe('newline normalization', () => {
    it('should normalize CRLF to LF in prompt', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'line1\r\nline2',
        negativePrompt: '',
        width: 512,
        height: 512,
      };

      const result = formatAsWebUI(metadata);

      const expected = ['line1\nline2', 'Size: 512x512'].join('\n');

      expect(result).toBe(expected);
      expect(result).not.toContain('\r');
    });

    it('should normalize CR to LF in negative prompt', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: 'neg1\rneg2',
        width: 512,
        height: 512,
      };

      const result = formatAsWebUI(metadata);

      const expected = [
        'test',
        'Negative prompt: neg1\nneg2',
        'Size: 512x512',
      ].join('\n');

      expect(result).toBe(expected);
      expect(result).not.toContain('\r');
    });

    it('should handle mixed line endings', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'a\r\nb\rc\nd',
        negativePrompt: 'x\r\ny\rz',
        width: 512,
        height: 512,
      };

      const result = formatAsWebUI(metadata);

      // All normalized to \n
      const expected = [
        'a\nb\nc\nd',
        'Negative prompt: x\ny\nz',
        'Size: 512x512',
      ].join('\n');

      expect(result).toBe(expected);
      expect(result).not.toContain('\r');
    });

    it('should normalize character prompts', () => {
      const metadata: NovelAIMetadata = {
        software: 'novelai',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [
          {
            prompt: 'char1\r\nchar2',
            center: { x: 0.5, y: 0.5 },
          },
        ],
      };

      const result = formatAsWebUI(metadata);

      const expected = [
        'test',
        '# Character 1 [0.5, 0.5]:',
        'char1\nchar2',
        'Size: 512x512',
      ].join('\n');

      expect(result).toBe(expected);
      expect(result).not.toContain('\r');
    });
  });

  describe('round-trip compatibility', () => {
    it('should maintain data integrity through parse→serialize→parse', () => {
      const original: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres, bad quality',
        width: 512,
        height: 768,
        model: {
          name: 'model-v1',
          hash: 'abc123',
        },
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          scheduler: 'Automatic',
          cfg: 7.5,
          seed: 123456,
          clipSkip: 2,
        },
        hires: {
          scale: 2,
          upscaler: 'Latent',
          steps: 10,
          denoise: 0.5,
        },
      };

      // Serialize
      const serialized = formatAsWebUI(original);

      // Parse back
      const parsed = parseA1111Text(serialized);

      expect(parsed).not.toBeNull();
      if (parsed) {
        expect(parsed.prompt).toBe(original.prompt);
        expect(parsed.negativePrompt).toBe(original.negativePrompt);
        expect(parsed.width).toBe(original.width);
        expect(parsed.height).toBe(original.height);
        expect(parsed.model).toBeDefined();
        expect(parsed.sampling).toBeDefined();
        expect(parsed.hires).toBeDefined();
        if (parsed.model && original.model) {
          expect(parsed.model).toMatchObject(original.model);
        }
        if (parsed.sampling && original.sampling) {
          expect(parsed.sampling).toMatchObject(original.sampling);
        }
        if (parsed.hires && original.hires) {
          expect(parsed.hires).toMatchObject(original.hires);
        }
      }
    });

    it('should handle minimal metadata round-trip', () => {
      const original: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'simple prompt',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const serialized = formatAsWebUI(original);
      const parsed = parseA1111Text(serialized);

      // This will be null because Parser requires AI markers (Steps, Sampler, or Negative prompt)
      // Minimal metadata with width/height: 0 won't have Size field, so parser will reject it
      expect(parsed).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: '',
        negativePrompt: '',
        width: 512,
        height: 512,
      };

      const result = formatAsWebUI(metadata);

      // Empty prompt still outputs Size since width/height are positive
      const expected = ['', 'Size: 512x512'].join('\n');

      expect(result).toBe(expected);
    });

    it('should handle zero seed', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: {
          seed: 0,
        },
      };

      const result = formatAsWebUI(metadata);

      const expected = ['test', 'Seed: 0, Size: 512x512'].join('\n');

      expect(result).toBe(expected);
    });

    it('should handle partial hires settings', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        hires: {
          scale: 2,
          // Only scale, no upscaler/steps/denoise
        },
      };

      const result = formatAsWebUI(metadata);

      const expected = ['test', 'Size: 512x512, Hires upscale: 2'].join('\n');

      expect(result).toBe(expected);
    });

    it('should omit settings line when no settings present', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'just a prompt',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const result = formatAsWebUI(metadata);

      // No settings line at all
      expect(result).toBe('just a prompt');
      expect(result.split('\n')).toHaveLength(1);
    });
  });
});
