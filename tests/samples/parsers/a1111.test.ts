import { describe, expect, it } from 'vitest';
import { parseA1111 } from '../../../src/parsers/a1111';
import type { StandardMetadata } from '../../../src/types';
import { parseConvertedSample, parsePngSample } from '../helpers';

describe('A1111 Parsers - Samples', () => {
  describe('SD WebUI samples', () => {
    it('should parse sd-webui.png', () => {
      const meta = parsePngSample<StandardMetadata>('sd-webui.png', parseA1111);

      expect(meta).toEqual({
        software: 'sd-webui',
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
          cfg: 7,
          seed: 3782896554,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-webui-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'sd-webui-hires.png',
        parseA1111,
      );

      expect(meta).toEqual({
        software: 'sd-webui',
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
          cfg: 5.5,
          seed: 3888671826,
        },
        hires: {
          scale: 1.5,
          upscaler: 'R-ESRGAN 4x+ Anime6B',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });
  });

  describe('Forge samples', () => {
    it('should parse forge.png', () => {
      const meta = parsePngSample<StandardMetadata>('forge.png', parseA1111);

      expect(meta).toEqual({
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
          sampler: 'Euler',
          scheduler: 'Karras',
          steps: 25,
          cfg: 5,
          seed: 747066619,
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });

  describe('Forge Classic samples', () => {
    it('should parse forge-classic.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-classic.png',
        parseA1111,
      );

      expect(meta).toEqual({
        software: 'forge-classic',
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

    it('should parse forge-classic-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-classic-hires.png',
        parseA1111,
      );

      expect(meta).toEqual({
        software: 'forge-classic',
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
  });

  describe('Forge Neo samples', () => {
    it('should parse forge-neo.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-neo.png',
        parseA1111,
      );

      expect(meta).toEqual({
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
      const meta = parsePngSample<StandardMetadata>(
        'forge-neo-hires.png',
        parseA1111,
      );

      expect(meta).toEqual({
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

  describe('reForge samples', () => {
    it('should parse reforge.png', () => {
      const meta = parsePngSample<StandardMetadata>('reforge.png', parseA1111);

      expect(meta).toEqual({
        software: 'reforge',
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
          seed: 270740395,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse reforge-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'reforge-hires.png',
        parseA1111,
      );

      expect(meta).toEqual({
        software: 'reforge',
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
          seed: 879759072,
        },
        hires: {
          scale: 1.5,
          upscaler: 'R-ESRGAN 4x+ Anime6B',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });

    it('should parse reforge.jpeg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'reforge.jpeg',
      );

      expect(meta).toEqual({
        software: 'reforge',
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
          seed: 584157617,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse reforge-hires.jpeg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'reforge-hires.jpeg',
      );

      expect(meta).toEqual({
        software: 'reforge',
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
          seed: 3494396176,
        },
        hires: {
          scale: 1.5,
          upscaler: 'R-ESRGAN 4x+ Anime6B',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });

    it('should parse reforge-hires.webp', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'reforge-hires.webp',
      );

      expect(meta).toEqual({
        software: 'reforge',
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
          seed: 1010990389,
        },
        hires: {
          scale: 1.5,
          upscaler: 'R-ESRGAN 4x+ Anime6B',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
      });
    });
  });

  describe('EasyReforge samples', () => {
    it('should parse easy-reforge.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'easy-reforge.png',
        parseA1111,
      );

      expect(meta).toEqual({
        software: 'easy-reforge',
        prompt:
          '1girl, solo, hatsune miku, テスト, \n<lora:NoobV065sHyperDmd:1> masterpiece, best quality, very aesthetic, absurdres, newest, safe',
        negativePrompt: 'bad anatomy, worst quality, low quality',
        width: 1024,
        height: 1024,
        model: {
          name: 'copycatNoob_v11',
          hash: '6c015a2deb',
        },
        sampling: {
          sampler: 'LCM',
          scheduler: 'SGM Uniform',
          steps: 4,
          cfg: 1,
          seed: 2582194946,
        },
        hires: {
          scale: 1.5,
          upscaler: 'Latent (nearest-exact)',
          denoise: 0.6,
        },
        upscale: undefined,
      });
    });
  });

  describe('SD-Next samples', () => {
    it('should parse sd-next.png', () => {
      const meta = parsePngSample<StandardMetadata>('sd-next.png', parseA1111);

      expect(meta).toEqual({
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
      const meta = parsePngSample<StandardMetadata>(
        'sd-next-hires.png',
        parseA1111,
      );

      expect(meta).toEqual({
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
    it('should parse sd-webui.jpg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'sd-webui.jpg',
      );

      expect(meta).toEqual({
        software: 'sd-webui',
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
          cfg: 5.5,
          seed: 3623174757,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-classic.jpeg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'forge-classic.jpeg',
      );

      expect(meta).toEqual({
        software: 'forge-classic',
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

    it('should parse forge-classic-hires.jpeg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'forge-classic-hires.jpeg',
      );

      expect(meta).toEqual({
        software: 'forge-classic',
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
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'forge-neo.jpeg',
      );

      expect(meta).toEqual({
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
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'civitai.jpeg',
      );

      expect(meta).toEqual({
        software: 'civitai',
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
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'sd-next.jpg',
      );

      expect(meta).toEqual({
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
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'sd-next-hires.jpg',
      );

      expect(meta).toEqual({
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
    it('should parse sd-webui.webp', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'sd-webui.webp',
      );

      expect(meta).toEqual({
        software: 'sd-webui',
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
          cfg: 5.5,
          seed: 1028435836,
          clipSkip: undefined,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-classic.webp', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'forge-classic.webp',
      );

      expect(meta).toEqual({
        software: 'forge-classic',
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

    it('should parse forge-classic-hires.webp', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'forge-classic-hires.webp',
      );

      expect(meta).toEqual({
        software: 'forge-classic',
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
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'forge-neo.webp',
      );

      expect(meta).toEqual({
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
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'sd-next.webp',
      );

      expect(meta).toEqual({
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
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'sd-next-hires.webp',
      );

      expect(meta).toEqual({
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
