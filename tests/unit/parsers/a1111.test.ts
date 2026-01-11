import { describe, expect, it } from 'vitest';
import { parseA1111 } from '../../../src/parsers/a1111';
import type { MetadataEntry } from '../../../src/types';

/**
 * Helper to create A1111 parameters entry
 */
function createA1111Entry(parameters: string): MetadataEntry[] {
  return [{ keyword: 'parameters', text: parameters }];
}

describe('parseA1111 - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: MetadataEntry[] = [];

      const result = parseA1111(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for missing Size', () => {
      // NOTE: This behavior differs from SD Prompt Reader, which falls back to "0x0"
      // when Size is missing. Future improvement: align with SD Prompt Reader by
      // making Size optional, returning width=0, height=0 instead of error.
      // See: https://github.com/receyuki/stable-diffusion-prompt-reader/blob/master/sd_prompt_reader/format/a1111.py
      const parameters = `test prompt
Steps: 20`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal A1111 metadata', () => {
      const parameters = `a beautiful landscape
Steps: 20, Size: 512x768`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('sd-webui');
        expect(result.value.type).toBe('a1111');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should parse with negative prompt', () => {
      const parameters = `positive prompt
Negative prompt: lowres, bad quality
Steps: 20, Size: 512x512`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('positive prompt');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract sampling settings', () => {
      const parameters = `test
Steps: 28, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7.5, Seed: 123456, Size: 512x512, Clip skip: 2`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          steps: 28,
          sampler: 'Euler a',
          scheduler: 'Automatic',
          cfg: 7.5,
          seed: 123456,
          clipSkip: 2,
        });
      }
    });

    it('should extract model settings', () => {
      const parameters = `test
Steps: 20, Size: 512x512, Model: test-model-v1, Model hash: abc123def`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'test-model-v1',
          hash: 'abc123def',
        });
      }
    });

    it('should extract hires settings', () => {
      const parameters = `test
Steps: 20, Size: 512x512, Hires upscale: 2, Hires upscaler: Latent, Hires steps: 10, Denoising strength: 0.5`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hires).toMatchObject({
          scale: 2,
          upscaler: 'Latent',
          steps: 10,
          denoise: 0.5,
        });
      }
    });
  });

  describe('software variant detection', () => {
    it('should detect sd-webui (default)', () => {
      const parameters = `test
Steps: 20, Size: 512x512`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('sd-webui');
      }
    });

    it('should detect forge from Version', () => {
      const parameters = `test
Steps: 20, Size: 512x512, Version: f1.0.0`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('forge');
      }
    });

    it('should detect forge-neo from Version', () => {
      const parameters = `test
Steps: 20, Size: 512x512, Version: neo`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('forge-neo');
      }
    });

    it('should detect sd-next from App', () => {
      const parameters = `test
Steps: 20, Size: 512x512, App: SD.Next`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('sd-next');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle prompt with commas', () => {
      const parameters = `test, test, test
Steps: 20, Size: 512x512`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test, test, test');
      }
    });

    it('should handle parsing with complex settings', () => {
      // Model names with commas get split by the parser - this is a known limitation
      const parameters = `test
Steps: 20, Size: 512x512, Model: model-v1, Sampler: Euler a`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Parser will extract multiple key-values
        expect(result.value.sampling?.sampler).toBe('Euler a');
      }
    });

    it('should handle JPEG Comment entry', () => {
      const parameters = `test
Steps: 20, Size: 512x512`;
      const entries: MetadataEntry[] = [
        { keyword: 'Comment', text: parameters },
      ];

      const result = parseA1111(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
      }
    });
  });
});
