import { describe, expect, it } from 'vitest';
import { parseMetadata } from '../../../src/parsers';
import type { StandardMetadata } from '../../../src/types';
import { parseConvertedSample, parsePngSample } from '../helpers';

/**
 * Easy Diffusion samples (txt2img, SDXL, no upscaler): a plain and a LoRA
 * generation in PNG, plus one of each as JPEG and WebP.
 *
 * - PNG: one chunk per request field; `prompt` is iTXt because it holds
 *   non-Latin-1 text, everything else is tEXt with Python `str()` values
 *   (`"None"` for unset options, `""` for no VAE, `"False"` for booleans,
 *   Python list repr for the LoRA fields)
 * - JPEG/WebP: the same fields as a JSON object in EXIF UserComment with
 *   native types (`null`, `false`, numbers, arrays)
 *
 * Unset options must not surface (no `upscale`, no `vae`, no `scheduler`).
 * The LoRA fields (`use_lora_model`, `lora_alpha`) are not parsed yet.
 */
describe('Easy Diffusion Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse easy-diffusion.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'easy-diffusion.png',
        parseMetadata,
      );

      expect(meta).toEqual({
        software: 'easydiffusion',
        prompt:
          'general, masterpiece, best quality, amazing quality, 1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
        },
        sampling: {
          sampler: 'euler_a',
          steps: 21,
          cfg: 5.1,
          seed: '514675176',
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse easy-diffusion-lora.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'easy-diffusion-lora.png',
        parseMetadata,
      );

      // `use_lora_model` / `lora_alpha` carry three LoRAs as Python list repr
      expect(meta).toEqual({
        software: 'easydiffusion',
        prompt:
          'general, masterpiece, best quality, amazing quality, 1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
        },
        sampling: {
          sampler: 'euler_a',
          steps: 21,
          cfg: 5.1,
          seed: '216312615',
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });

  describe('JPEG samples', () => {
    it('should parse easy-diffusion.jpeg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'easy-diffusion.jpeg',
      );

      expect(meta).toEqual({
        software: 'easydiffusion',
        prompt:
          'general, masterpiece, best quality, amazing quality, 1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
        },
        sampling: {
          sampler: 'euler_a',
          steps: 21,
          cfg: 5.1,
          seed: '530900047',
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });

  describe('WebP samples', () => {
    it('should parse easy-diffusion-lora.webp', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'easy-diffusion-lora.webp',
      );

      // `use_lora_model` / `lora_alpha` carry three LoRAs as JSON arrays
      expect(meta).toEqual({
        software: 'easydiffusion',
        prompt:
          'general, masterpiece, best quality, amazing quality, 1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
        },
        sampling: {
          sampler: 'euler_a',
          steps: 21,
          cfg: 5.1,
          seed: '3052478612',
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
