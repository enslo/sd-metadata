import { describe, expect, it } from 'vitest';
import { parseA1111 } from '../../../src/parsers/a1111';
import type { A1111Metadata } from '../../../src/types';
import { parseConvertedSample, parsePngSample } from '../helpers';

describe('A1111 Parsers - Samples', () => {
  describe('Forge samples', () => {
    it('should parse forge.png', () => {
      const meta = parsePngSample<A1111Metadata>('forge.png', parseA1111);

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 6,
          seed: 1239240392,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-hires.png', () => {
      const meta = parsePngSample<A1111Metadata>('forge-hires.png', parseA1111);

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 6,
          seed: 2301589892,
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN-UltraSharp-4x',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });

    it('should parse forge-neo.png', () => {
      const meta = parsePngSample<A1111Metadata>('forge-neo.png', parseA1111);

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge-neo',
        prompt:
          'general, masterpiece, best quality, amazing quality,\n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'Euler a',
          scheduler: 'Automatic',
          steps: 24,
          cfg: 6,
          seed: 4179307297,
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-neo-hires.png', () => {
      const meta = parsePngSample<A1111Metadata>(
        'forge-neo-hires.png',
        parseA1111,
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge-neo',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku,',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'Euler a',
          scheduler: 'Automatic',
          steps: 24,
          cfg: 6,
          seed: 449383496,
          clipSkip: 2,
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });
  });

  describe('Civitai samples', () => {
    it('should parse civitai.png', () => {
      const meta = parsePngSample<A1111Metadata>('civitai.png', parseA1111);

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-webui',
        prompt:
          '1girl, hatsune miku, dress, long hair, jewelry, white dress, blue eyes, necklace, bubble, solo, underwater, hair between eyes, looking at viewer, bangs, blue hair, bow, reaching towards viewer, blue theme, air bubble, hair bow, collarbone, floating hair, frills, twintails, blurry foreground, frilled dress, off-shoulder dress, bare shoulders, blurry, very long hair\n,masterpiece,best quality,amazing quality,',
        negativePrompt: 'bad quality,worst quality,worst detail,sketch,censor,',
        width: 1024,
        height: 1360,
        model: {
          name: 'WAI-Nsfw-Illustrious-16',
          hash: 'a5f58eb1c3',
        },
        sampling: {
          sampler: 'Euler a',
          scheduler: 'Automatic',
          steps: 30,
          cfg: 7,
          seed: 2073075463,
          clipSkip: 2,
        },
        hires: {
          scale: 1.5,
          upscaler: 'R-ESRGAN 4x+ Anime6B',
          steps: 20,
          denoise: 0.5,
        },
        upscale: undefined,
      });
    });
  });

  describe('SD-Next samples', () => {
    it('should parse sd-next.png', () => {
      const meta = parsePngSample<A1111Metadata>('sd-next.png', parseA1111);

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-next',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DDIM',
          steps: 20,
          cfg: 6,
          seed: 2427651458,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-next-hires.png', () => {
      const meta = parsePngSample<A1111Metadata>(
        'sd-next-hires.png',
        parseA1111,
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-next',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DDIM',
          steps: 20,
          cfg: 6,
          seed: 1968293115,
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN 4x Ultrasharp',
        },
        upscale: undefined,
      });
    });
  });

  describe('JPEG samples', () => {
    it('should parse forge.jpeg', () => {
      const meta = parseConvertedSample<A1111Metadata>('jpeg', 'forge.jpeg');

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 6,
          seed: 2547514258,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-hires.jpeg', () => {
      const meta = parseConvertedSample<A1111Metadata>(
        'jpeg',
        'forge-hires.jpeg',
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 6,
          seed: 3452054396,
          clipSkip: undefined,
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN-UltraSharp-4x',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });

    it('should parse forge-neo.jpeg', () => {
      const meta = parseConvertedSample<A1111Metadata>(
        'jpeg',
        'forge-neo.jpeg',
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge-neo',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku,',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'Euler a',
          scheduler: 'Automatic',
          steps: 24,
          cfg: 6,
          seed: 2417156106,
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse civitai.jpeg', () => {
      const meta = parseConvertedSample<A1111Metadata>('jpeg', 'civitai.jpeg');

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-webui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: undefined,
        sampling: {
          sampler: 'Euler a',
          steps: 25,
          cfg: 5,
          seed: 1311178179,
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-next.jpg', () => {
      const meta = parseConvertedSample<A1111Metadata>('jpeg', 'sd-next.jpg');

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-next',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'Euler a',
          steps: 20,
          cfg: 6,
          seed: 899700607,
          clipSkip: undefined,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-next-hires.jpg', () => {
      const meta = parseConvertedSample<A1111Metadata>(
        'jpeg',
        'sd-next-hires.jpg',
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-next',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DDIM',
          steps: 20,
          cfg: 6,
          seed: 3970581939,
          clipSkip: undefined,
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN 4x Ultrasharp',
          steps: undefined,
          denoise: undefined,
        },
        upscale: undefined,
      });
    });
  });

  describe('WebP samples', () => {
    it('should parse forge.webp', () => {
      const meta = parseConvertedSample<A1111Metadata>('webp', 'forge.webp');

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 6,
          seed: 2630661657,
          clipSkip: undefined,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-hires.webp', () => {
      const meta = parseConvertedSample<A1111Metadata>(
        'webp',
        'forge-hires.webp',
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 6,
          seed: 2991931972,
          clipSkip: undefined,
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN-UltraSharp-4x',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });

    it('should parse forge-neo.webp', () => {
      const meta = parseConvertedSample<A1111Metadata>(
        'webp',
        'forge-neo.webp',
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'forge-neo',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku,',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'Euler a',
          scheduler: 'Automatic',
          steps: 24,
          cfg: 6,
          seed: 2056443400,
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-next.webp', () => {
      const meta = parseConvertedSample<A1111Metadata>('webp', 'sd-next.webp');

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-next',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'DDIM',
          steps: 20,
          cfg: 6,
          seed: 3014033436,
          clipSkip: undefined,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-next-hires.webp', () => {
      const meta = parseConvertedSample<A1111Metadata>(
        'webp',
        'sd-next-hires.webp',
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'sd-next',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: '45a21ea00a',
        },
        sampling: {
          sampler: 'Euler a',
          steps: 20,
          cfg: 6,
          seed: 1755251313,
          scheduler: undefined,
          clipSkip: undefined,
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN 4x Remacri',
          steps: undefined,
          denoise: undefined,
        },
        upscale: undefined,
      });
    });
  });
});
