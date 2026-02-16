import { describe, expect, it } from 'vitest';
import { buildEmbedText } from '../../../src/api/stringify';
import type { EmbedMetadata } from '../../../src/types';

describe('buildEmbedText - Unit Tests', () => {
  describe('basic serialization', () => {
    it('should serialize prompt and negativePrompt only', () => {
      const metadata: EmbedMetadata = {
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres, bad quality',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'masterpiece, 1girl',
        'Negative prompt: lowres, bad quality',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should omit negative prompt when empty', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test prompt',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText(metadata);

      expect(result).toBe('test prompt');
    });

    it('should normalize CRLF to LF in prompts', () => {
      const metadata: EmbedMetadata = {
        prompt: 'line1\r\nline2',
        negativePrompt: 'neg1\r\nneg2',
        width: 512,
        height: 512,
      };

      const result = buildEmbedText(metadata);

      expect(result).not.toContain('\r');
      expect(result).toContain('line1\nline2');
      expect(result).toContain('Negative prompt: neg1\nneg2');
    });
  });

  describe('sampling settings', () => {
    it('should output all sampling fields in settings line', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 768,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          scheduler: 'Automatic',
          cfg: 7.5,
          seed: 123456,
          clipSkip: 2,
        },
        model: {
          name: 'model-v1',
          hash: 'abc123',
        },
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        'Steps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7.5, Seed: 123456, Size: 512x768, Model hash: abc123, Model: model-v1, Clip skip: 2',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should include hires settings in settings line', () => {
      const metadata: EmbedMetadata = {
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

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        'Size: 512x512, Denoising strength: 0.5, Hires upscale: 2, Hires steps: 10, Hires upscaler: Latent',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should merge upscale into hires format', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        upscale: {
          scale: 2,
          upscaler: 'ESRGAN-4x',
        },
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        'Size: 512x512, Hires upscale: 2, Hires upscaler: ESRGAN-4x',
      ].join('\n');

      expect(result).toBe(expected);
    });
  });

  describe('extras handling', () => {
    it('should append extras to settings line', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
        },
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Version: 'v1.10.0', 'Lora hashes': 'abc123' },
      });

      const expected = [
        'test',
        'Steps: 20, Sampler: Euler a, Size: 512x512, Version: v1.10.0, Lora hashes: abc123',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should override structured fields with extras at their position', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          cfg: 7,
        },
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 30, Version: 'v1.0' },
      });

      // Steps: 30 should be at position 1 (where structured Steps would be)
      // Version should be at the end
      const expected = [
        'test',
        'Steps: 30, Sampler: Euler a, CFG scale: 7, Size: 512x512, Version: v1.0',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should override multiple structured fields with extras', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          cfg: 7,
          seed: 42,
        },
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 30, Seed: 999, Version: 'v1.0' },
      });

      const expected = [
        'test',
        'Steps: 30, Sampler: Euler a, CFG scale: 7, Seed: 999, Size: 512x512, Version: v1.0',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should build settings line from extras only (no sampling)', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 20, Sampler: 'DPM++ 2M', Version: 'v1.0' },
      });

      const expected = [
        'test',
        'Steps: 20, Sampler: DPM++ 2M, Version: v1.0',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should handle empty extras object same as no extras', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: { steps: 20 },
      };

      const withEmpty = buildEmbedText({ ...metadata, extras: {} });
      const withoutExtras = buildEmbedText(metadata);

      expect(withEmpty).toBe(withoutExtras);
    });

    it('should handle numeric extras values', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 20, 'CFG scale': 7.5 },
      });

      const expected = ['test', 'Steps: 20, CFG scale: 7.5'].join('\n');

      expect(result).toBe(expected);
    });
  });

  describe('character prompts', () => {
    it('should include character prompts between positive and negative prompts', () => {
      const metadata: EmbedMetadata = {
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

      const result = buildEmbedText(metadata);

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
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [{ prompt: 'character without coords' }],
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        '# Character 1:',
        'character without coords',
        'Size: 512x512',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should skip empty characterPrompts array', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [],
      };

      const result = buildEmbedText(metadata);

      expect(result).not.toContain('# Character');
    });

    it('should normalize line endings in character prompts', () => {
      const metadata: EmbedMetadata = {
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

      const result = buildEmbedText(metadata);

      expect(result).not.toContain('\r');
      expect(result).toContain('char1\nchar2');
    });
  });
});
