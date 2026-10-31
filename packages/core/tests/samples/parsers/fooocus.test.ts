import { describe, expect, it } from 'vitest';
import { parseMetadata } from '../../../src/parsers';
import type { StandardMetadata } from '../../../src/types';
import { parseConvertedSample, parsePngSample } from '../helpers';

/**
 * Fooocus v2.5.5 samples, one per metadata scheme and container.
 *
 * Fooocus lets the user pick the metadata scheme under Advanced →
 * Developer Debug Mode → Save Metadata to Images:
 * - `fooocus` (default): a JSON object; non-ASCII characters are
 *   `\uXXXX`-escaped, so prompts survive every container unchanged
 * - `a1111`: A1111-compatible text, dispatched to parseA1111 with
 *   software `fooocus`; style expansion and prompt expansion are already
 *   merged into the prompt, `Scheduler: karras` is not the A1111
 *   `Schedule type` key, and the sampler name carries the scheduler
 *
 * All five files share the same generation settings except the seed,
 * which is a 64-bit value and therefore kept as a string.
 */
describe('Fooocus Parsers - Samples', () => {
  describe('fooocus scheme (JSON)', () => {
    it('should parse fooocus.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'fooocus.png',
        parseMetadata,
      );

      expect(meta).toEqual({
        software: 'fooocus',
        prompt:
          'general, masterpiece, best quality, amazing quality\n1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
          hash: '45add30a71',
          vae: 'Default (model)',
        },
        sampling: {
          sampler: 'dpmpp_2m_sde_gpu',
          scheduler: 'karras',
          steps: 30,
          cfg: 4,
          seed: '7100816951239959675',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse fooocus.jpg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'fooocus.jpg',
      );

      expect(meta).toEqual({
        software: 'fooocus',
        prompt:
          'general, masterpiece, best quality, amazing quality\n1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
          hash: '45add30a71',
          vae: 'Default (model)',
        },
        sampling: {
          sampler: 'dpmpp_2m_sde_gpu',
          scheduler: 'karras',
          steps: 30,
          cfg: 4,
          seed: '7997558647298758616',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse fooocus.webp', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'fooocus.webp',
      );

      expect(meta).toEqual({
        software: 'fooocus',
        prompt:
          'general, masterpiece, best quality, amazing quality\n1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
          hash: '45add30a71',
          vae: 'Default (model)',
        },
        sampling: {
          sampler: 'dpmpp_2m_sde_gpu',
          scheduler: 'karras',
          steps: 30,
          cfg: 4,
          seed: '8636439303874759085',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });

  describe('a1111 scheme (text)', () => {
    it('should parse fooocus-a1111.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'fooocus-a1111.png',
        parseMetadata,
      );

      // Quality performance: prompt expansion appended after the user prompt
      expect(meta).toEqual({
        software: 'fooocus',
        prompt:
          'general, masterpiece, best quality, amazing quality, 1girl, solo, hatsune miku, double v, #テスト, general, masterpiece, best quality, amazing quality, very detailed, highly consistent, innocent colors, beautiful, epic, stunning, gorgeous, cinematic, dramatic ambient light, professional, winning, artistic, clear, complex, appealing, novel, cool, color, awesome, perfect, focus, creative, positive, joyful, unique, cute, nice, attractive, marvelous, pure',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
          hash: '45add30a71',
        },
        sampling: {
          sampler: 'DPM++ 2M SDE Karras',
          steps: 60,
          cfg: 4,
          seed: '4575475577937763433',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse fooocus-a1111.jpg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'fooocus-a1111.jpg',
      );

      // Fooocus writes the a1111-scheme UserComment as plain ASCII, so the
      // non-ASCII characters of the prompt ("#テスト") are already "#???"
      // in the file; the JSON scheme escapes them and is unaffected.
      // Styles "Artstyle Watercolor" and "Misc Kawaii" are expanded into
      // both prompts.
      expect(meta).toEqual({
        software: 'fooocus',
        prompt:
          'watercolor painting general, masterpiece, best quality, amazing quality . vibrant, beautiful, painterly, detailed, textural, artistic, 1girl, solo, hatsune miku, double v, #???',
        negativePrompt:
          '(worst quality, low quality, normal quality, lowres, low details, oversaturated, undersaturated, overexposed, underexposed, grayscale, bw, bad photo, bad photography, bad art:1.4), (watermark, signature, text font, username, error, logo, words, letters, digits, autograph, trademark, name:1.2), (blur, blurry, grainy), morbid, ugly, asymmetrical, mutated malformed, mutilated, poorly lit, bad shadow, draft, cropped, out of frame, cut off, censored, jpeg artifacts, out of focus, glitch, duplicate, (airbrushed, cartoon, anime, semi-realistic, cgi, render, blender, digital art, manga, amateur:1.3), (3D ,3D Game, 3D Game Scene, 3D Character:1.1), (bad hands, bad anatomy, bad body, bad face, bad teeth, bad arms, bad legs, deformities:1.3), anime, photorealistic, 35mm film, deformed, glitch, low contrast, noisy, bad quality, worst quality, worst detail, sketch, censor',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
          hash: '45add30a71',
        },
        sampling: {
          sampler: 'DPM++ 2M SDE Karras',
          steps: 30,
          cfg: 4,
          seed: '4879207425105948821',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
