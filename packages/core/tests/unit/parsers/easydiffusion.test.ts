import { describe, expect, it } from 'vitest';
import { parseEasyDiffusion } from '../../../src/parsers/easydiffusion';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create Easy Diffusion PNG-style entries
 *
 * Easy Diffusion stores each field as a separate PNG tEXt chunk.
 * All keys use snake_case format.
 */
function createPngEntries(overrides: Record<string, string> = {}): EntryRecord {
  return {
    prompt: 'a beautiful landscape',
    negative_prompt: 'blurry, ugly',
    seed: '12345',
    use_stable_diffusion_model: 'sd-v1-5',
    sampler_name: 'euler_a',
    num_inference_steps: '25',
    guidance_scale: '7.5',
    clip_skip: '1',
    width: '512',
    height: '768',
    ...overrides,
  };
}

/**
 * Helper to create Easy Diffusion JPEG/WebP-style entries
 *
 * Easy Diffusion stores all fields as JSON in EXIF UserComment.
 */
function createJsonEntry(metadata: Record<string, unknown>): EntryRecord {
  return { UserComment: JSON.stringify(metadata) };
}

describe('parseEasyDiffusion - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for empty entries', () => {
      const entries: EntryRecord = {};

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for non-JSON UserComment', () => {
      const entries: EntryRecord = { UserComment: 'plain text' };

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON in UserComment', () => {
      const entries: EntryRecord = { UserComment: '{invalid json}' };

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('PNG format (standalone entries)', () => {
    it('should parse basic fields from PNG tEXt chunks', () => {
      const entries = createPngEntries();

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('easydiffusion');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('blurry, ugly');
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should extract model name from path', () => {
      const entries = createPngEntries({
        use_stable_diffusion_model:
          'models/stable-diffusion/sd-v1-5.safetensors',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model?.name).toBe('sd-v1-5.safetensors');
      }
    });

    it('should extract sampling settings', () => {
      const entries = createPngEntries();

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          sampler: 'euler_a',
          steps: 25,
          cfg: 7.5,
          seed: 12345,
          clipSkip: 1,
        });
      }
    });

    it('should extract VAE model', () => {
      const entries = createPngEntries({
        use_vae_model: 'vae-ft-mse-840000-ema-pruned',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model?.vae).toBe('vae-ft-mse-840000-ema-pruned');
      }
    });
  });

  describe('JPEG/WebP format (JSON in UserComment)', () => {
    it('should parse JSON from UserComment', () => {
      const entries = createJsonEntry({
        prompt: 'a cat sitting',
        negative_prompt: 'lowres',
        seed: 99999,
        use_stable_diffusion_model: 'sd-v1-5',
        sampler_name: 'ddim',
        num_inference_steps: 30,
        guidance_scale: 8.0,
        width: 1024,
        height: 1024,
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('easydiffusion');
        expect(result.value.prompt).toBe('a cat sitting');
        expect(result.value.width).toBe(1024);
        expect(result.value.sampling?.seed).toBe(99999);
      }
    });

    it('should fall back to parameters if UserComment is missing', () => {
      const entries: EntryRecord = {
        parameters: JSON.stringify({
          prompt: 'from parameters',
          use_stable_diffusion_model: 'model',
          seed: 1,
          width: 512,
          height: 512,
        }),
      };

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('from parameters');
      }
    });
  });

  describe('model path extraction', () => {
    it('should extract filename from POSIX path', () => {
      const entries = createPngEntries({
        use_stable_diffusion_model: 'path/to/model.safetensors',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model?.name).toBe('model.safetensors');
      }
    });

    it('should extract filename from Windows path', () => {
      const entries = createPngEntries({
        use_stable_diffusion_model: 'C:\\Users\\models\\sd-v1-5.ckpt',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model?.name).toBe('sd-v1-5.ckpt');
      }
    });

    it('should keep bare filename as-is', () => {
      const entries = createPngEntries({
        use_stable_diffusion_model: 'sd-v1-5',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model?.name).toBe('sd-v1-5');
      }
    });
  });

  describe('upscale extraction', () => {
    it('should extract upscale settings', () => {
      const entries = createPngEntries({
        use_upscale: 'RealESRGAN_x4plus',
        upscale_amount: '4',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.upscale).toMatchObject({
          upscaler: 'RealESRGAN_x4plus',
          scale: 4,
        });
      }
    });

    it('should omit upscale when not present', () => {
      const entries = createPngEntries();

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.upscale).toBeUndefined();
      }
    });

    it('should extract upscale from JSON format', () => {
      const entries = createJsonEntry({
        prompt: 'test',
        use_stable_diffusion_model: 'model',
        seed: 1,
        width: 512,
        height: 512,
        use_upscale: 'RealESRGAN_x4plus_anime_6B',
        upscale_amount: 2,
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.upscale).toMatchObject({
          upscaler: 'RealESRGAN_x4plus_anime_6B',
          scale: 2,
        });
      }
    });
  });

  describe('denoise extraction (img2img)', () => {
    it('should extract prompt_strength as sampling.denoise', () => {
      const entries = createPngEntries({
        prompt_strength: '0.75',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling?.denoise).toBe(0.75);
      }
    });

    it('should omit denoise when prompt_strength is not present (txt2img)', () => {
      const entries = createPngEntries();

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling?.denoise).toBeUndefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      // Minimal entries without optional fields like use_vae_model, clip_skip
      const entries: EntryRecord = {
        prompt: '',
        negative_prompt: '',
        use_stable_diffusion_model: 'sd-v1-5',
        seed: '1',
        width: '512',
        height: '512',
      };

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });

    it('should trim prompt whitespace', () => {
      const entries = createPngEntries({
        prompt: '  a beautiful landscape  ',
        negative_prompt: '  blurry  ',
      });

      const result = parseEasyDiffusion(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('blurry');
      }
    });
  });
});
