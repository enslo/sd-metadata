import { describe, expect, it } from 'vitest';
import { parseFooocus } from '../../../src/parsers/fooocus';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create Fooocus JSON metadata entry
 *
 * Fooocus stores metadata in the `parameters` chunk (PNG) or
 * `UserComment` EXIF tag (JPEG/WebP).
 */
function createFooocusEntry(metadata: unknown): EntryRecord {
  return { parameters: JSON.stringify(metadata) };
}

describe('parseFooocus - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: EntryRecord = {};

      const result = parseFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for non-JSON parameters', () => {
      const entries: EntryRecord = { parameters: 'plain text' };

      const result = parseFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: EntryRecord = { parameters: '{invalid json}' };

      const result = parseFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });

    it('should read from UserComment when parameters is missing', () => {
      const metadata = {
        prompt: 'a landscape',
        negative_prompt: 'lowres',
        resolution: '(512, 768)',
      };
      const entries: EntryRecord = {
        UserComment: JSON.stringify(metadata),
      };

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('fooocus');
        expect(result.value.prompt).toBe('a landscape');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal Fooocus metadata', () => {
      const metadata = {
        prompt: 'a beautiful landscape',
        negative_prompt: 'lowres, bad quality',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('fooocus');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should parse resolution string into width and height', () => {
      const metadata = {
        prompt: 'test',
        resolution: '(1024, 1024)',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(1024);
        expect(result.value.height).toBe(1024);
      }
    });

    it('should parse non-square resolution string', () => {
      const metadata = {
        prompt: 'test',
        resolution: '(896, 1152)',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(896);
        expect(result.value.height).toBe(1152);
      }
    });
  });

  describe('model and sampling settings', () => {
    it('should extract model settings', () => {
      const metadata = {
        prompt: 'test',
        base_model: 'juggernautXL_v8Rundiffusion.safetensors',
        base_model_hash: 'aeb7c9a6261c',
        vae: 'sdxl_vae.safetensors',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'juggernautXL_v8Rundiffusion.safetensors',
          hash: 'aeb7c9a6261c',
          vae: 'sdxl_vae.safetensors',
        });
      }
    });

    it('should extract sampling settings with guidance_scale as cfg', () => {
      const metadata = {
        prompt: 'test',
        seed: 123456,
        steps: 30,
        guidance_scale: 7.0,
        sampler: 'dpmpp_2m_sde_gpu',
        scheduler: 'karras',
        clip_skip: 2,
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: 123456,
          steps: 30,
          cfg: 7.0,
          sampler: 'dpmpp_2m_sde_gpu',
          scheduler: 'karras',
          clipSkip: 2,
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should trim prompt whitespace', () => {
      const metadata = {
        prompt: '  test prompt  ',
        negative_prompt: '  negative  ',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test prompt');
        expect(result.value.negativePrompt).toBe('negative');
      }
    });

    it('should handle missing prompts', () => {
      const metadata = {
        resolution: '(1024, 1024)',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });

    it('should handle missing resolution', () => {
      const metadata = {
        prompt: 'test',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });

    it('should handle malformed resolution string', () => {
      const metadata = {
        prompt: 'test',
        resolution: 'invalid',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });

    it('should handle missing optional model and sampling fields', () => {
      const metadata = {
        prompt: 'test',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Model and sampling should still be defined but with undefined fields
        expect(result.value.model?.name).toBeUndefined();
        expect(result.value.sampling?.seed).toBeUndefined();
      }
    });
  });
});
