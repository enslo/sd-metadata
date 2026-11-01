import { describe, expect, it } from 'vitest';
import { parseMetadata } from '../../../src/parsers';
import type { StandardMetadata } from '../../../src/types';
import { parseConvertedSample, parsePngSample } from '../helpers';

describe('A1111 Parsers - Samples', () => {
  describe('SD WebUI samples', () => {
    it('should parse sd-webui.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'sd-webui.png',
        parseMetadata,
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
          cfg: 7,
          seed: '3782896554',
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-webui-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'sd-webui-hires.png',
        parseMetadata,
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
          seed: '3888671826',
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
      const meta = parsePngSample<StandardMetadata>('forge.png', parseMetadata);

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
          seed: '747066619',
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
        parseMetadata,
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
          seed: '1239240392',
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-classic-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-classic-hires.png',
        parseMetadata,
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
          seed: '2301589892',
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

    it('should parse forge-classic-adetailer.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-classic-adetailer.png',
        parseMetadata,
      );

      expect(meta).toEqual({
        software: 'forge-classic',
        prompt:
          'general, masterpiece, best quality, amazing quality,\n1girl, solo, hatsune miku, cowboy shot, dutch angle, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiNSFWIllustrious_v140',
          hash: 'c9b4dab236',
        },
        sampling: {
          sampler: 'Euler a',
          scheduler: 'Automatic',
          steps: 24,
          cfg: 4,
          seed: '4179307297',
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-classic-lora.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-classic-lora.png',
        parseMetadata,
      );

      // Three tags, one in the two-value form <lora:name:te:unet>; the hashes
      // come from "Lora hashes" (Forge Classic writes 12 hex digits)
      expect(meta).toEqual({
        software: 'forge-classic',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト\n <lora:LECO_GoodHands:-0.8> <lora:LECO_BadHands:0.8> <lora:Smooth_Booster_v5:0.1:0.5>',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiNSFWIllustrious_v140',
          hash: 'c9b4dab236',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 6,
          seed: '4155927651',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands', weight: -0.8, hash: 'fe3806374a03' },
          { name: 'LECO_BadHands', weight: 0.8, hash: '37c8880f409c' },
          {
            name: 'Smooth_Booster_v5',
            weight: 0.5,
            clipWeight: 0.1,
            hash: 'c121dd957230',
          },
        ],
      });
    });

    it('should parse forge-classic-lora_with_comma.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-classic-lora_with_comma.png',
        parseMetadata,
      );

      // A1111 keeps the comma in the tag but strips it when writing
      // "Lora hashes" (SmoothBooster_v3), so the hash is matched after the
      // same stripping
      expect(meta).toEqual({
        software: 'forge-classic',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト\n<lora:LECO_GoodHands:-0.8> <lora:LECO_BadHands:0.8> <lora:Smooth,Booster_v3:1>',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiNSFWIllustrious_v140',
          hash: 'c9b4dab236',
        },
        sampling: {
          sampler: 'DPM++ 2M',
          scheduler: 'Karras',
          steps: 20,
          cfg: 5.5,
          seed: '2694730617',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands', weight: -0.8, hash: 'fe3806374a03' },
          { name: 'LECO_BadHands', weight: 0.8, hash: '37c8880f409c' },
          { name: 'Smooth,Booster_v3', weight: 1, hash: '61d7ee6c08bd' },
        ],
      });
    });
  });

  describe('Forge Neo samples', () => {
    it('should parse forge-neo.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-neo.png',
        parseMetadata,
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
          seed: '4179307297',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse forge-neo-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-neo-hires.png',
        parseMetadata,
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
          seed: '449383496',
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

    it('should parse forge-neo-adetailer.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'forge-neo-adetailer.png',
        parseMetadata,
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
          name: 'waiNSFWIllustrious_v140',
          hash: 'c9b4dab236',
        },
        sampling: {
          sampler: 'Euler a',
          scheduler: 'Automatic',
          steps: 24,
          cfg: 4,
          seed: '4179307297',
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });

  describe('reForge samples', () => {
    it('should parse reforge.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'reforge.png',
        parseMetadata,
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
          seed: '270740395',
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse reforge-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'reforge-hires.png',
        parseMetadata,
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
          seed: '879759072',
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
          seed: '584157617',
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
          seed: '3494396176',
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
          seed: '1010990389',
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
        parseMetadata,
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
          seed: '2582194946',
        },
        hires: {
          scale: 1.5,
          upscaler: 'Latent (nearest-exact)',
          denoise: 0.6,
        },
        loras: [{ name: 'NoobV065sHyperDmd', weight: 1, hash: '45b5bd0819cf' }],
        upscale: undefined,
      });
    });
  });

  describe('SD-Next samples', () => {
    it('should parse sd-next.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'sd-next.png',
        parseMetadata,
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
          seed: '2427651458',
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse sd-next-hires.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'sd-next-hires.png',
        parseMetadata,
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
          seed: '1968293115',
        },
        hires: {
          scale: 1.5,
          upscaler: 'ESRGAN 4x Ultrasharp',
        },
        upscale: undefined,
      });
    });

    it('should parse sd-next-lora.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'sd-next-lora.png',
        parseMetadata,
      );

      // SD.Next echoes both prompts as "Template:" / "Negative template:"
      // lines after the negative prompt; they are dropped, so the tags count
      // once. No hashes: SD.Next only writes "LoRA networks" (names)
      expect(meta).toEqual({
        software: 'sd-next',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト\n<lora:LECO_GoodHands:-0.5> <lora:LECO_BadHands:1.0>',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
          hash: 'f116b0c78f',
        },
        sampling: {
          sampler: 'Default',
          steps: 20,
          seed: '123778995',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands', weight: -0.5 },
          { name: 'LECO_BadHands', weight: 1 },
        ],
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
          seed: '3623174757',
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
          seed: '2547514258',
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
          seed: '3452054396',
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
          seed: '2417156106',
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
          seed: '1311178179',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse civitai-lora.png (eXIf chunk)', () => {
      const meta = parsePngSample<StandardMetadata>(
        'civitai-lora.png',
        parseMetadata,
      );

      // CivitAI PNG downloads keep the same A1111-style UserComment as the
      // JPEGs, but inside an eXIf chunk and without any text chunk
      expect(meta).toEqual({
        software: 'civitai',
        prompt: 'perfect eyes, 1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt: 'bad quality, worst quality, 3d, jpeg artifacts,',
        width: 1024,
        height: 1024,
        model: undefined,
        sampling: {
          sampler: 'Euler a',
          steps: 20,
          cfg: 4.5,
          seed: '1070944611',
          clipSkip: 2,
        },
        loras: [
          {
            name: 'Eyes for Illustrious Lora (Perfect anime eyes)',
            weight: 0.35,
          },
          { name: 'Detailed anime style - Illustrious V2.0', weight: 0.4 },
          {
            name: 'Hands XL + SD 1.5 + F1D + Pony + Illustrious + zit + ZIB',
            weight: 0.95,
          },
        ],
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse civitai-lora.jpg', () => {
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'civitai-lora.jpg',
      );

      // CivitAI's A1111-style text has no tags; the LoRAs come from the
      // "Civitai resources" JSON (display names, weights, no hashes)
      expect(meta).toEqual({
        software: 'civitai',
        prompt: 'perfect eyes, 1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt: 'bad quality, worst quality, 3d, jpeg artifacts,',
        width: 1024,
        height: 1024,
        model: undefined,
        sampling: {
          sampler: 'Euler a',
          steps: 20,
          cfg: 4.5,
          seed: '667264311',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          {
            name: 'Hands XL + SD 1.5 + F1D + Pony + Illustrious + zit + ZIB',
            weight: 0.95,
          },
          { name: 'Detailed anime style - Illustrious V2.0', weight: 0.4 },
          {
            name: 'Eyes for Illustrious Lora (Perfect anime eyes)',
            weight: 0.35,
          },
        ],
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
          seed: '899700607',
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
          seed: '3970581939',
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
          seed: '1028435836',
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
          seed: '2630661657',
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
          seed: '2991931972',
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
          seed: '2056443400',
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
          seed: '3014033436',
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
          seed: '1755251313',
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
