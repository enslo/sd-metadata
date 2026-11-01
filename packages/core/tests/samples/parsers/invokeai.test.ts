import { describe, expect, it } from 'vitest';
import { parseInvokeAI } from '../../../src/parsers/invokeai';
import type { StandardMetadata } from '../../../src/types';
import { parsePngSample } from '../helpers';

describe('InvokeAI Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse invokeai.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'invokeai.png',
        parseInvokeAI,
      );

      expect(meta).toEqual({
        software: 'invokeai',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: 'blake3:7c1631b481e1566448f49db7e3b67a8a9d04742fa3c7d4548a0c81b619160c56',
        },
        sampling: {
          seed: '3951921344',
          steps: 24,
          cfg: 6,
          sampler: 'euler_a',
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse invokeai-hires.png with upscale settings', () => {
      const meta = parsePngSample<StandardMetadata>(
        'invokeai-hires.png',
        parseInvokeAI,
      );

      expect(meta).toEqual({
        software: 'invokeai',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 2048,
        height: 2048,
        model: {
          name: 'waiIllustriousSDXL_v160',
          hash: 'blake3:7c1631b481e1566448f49db7e3b67a8a9d04742fa3c7d4548a0c81b619160c56',
        },
        sampling: {
          seed: '1731018819',
          steps: 24,
          cfg: 2,
          sampler: 'kdpm_2',
        },
        upscale: {
          upscaler: 'RealESRGAN_x4plus_anime_6B',
          scale: 2,
        },
      });
    });

    it('should parse invokeai-lora.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'invokeai-lora.png',
        parseInvokeAI,
      );

      // InvokeAI 6.14.2: `loras[].model` is a full model record (name without
      // extension, blake3 hash kept with its prefix), `weight` is the strength
      expect(meta).toEqual({
        software: 'invokeai',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, #テスト\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
          hash: 'blake3:5a694d07c5f371b902bfa04622af80d4e7e1fa0e633b798c1f03d7d1252548d7',
        },
        sampling: {
          seed: '3955673604',
          steps: 20,
          cfg: 5,
          sampler: 'dpmpp_3m_k',
        },
        loras: [
          {
            name: 'LECO_GoodHands',
            weight: -0.8,
            hash: 'blake3:bfd3808a9c2bcb186b648487dbdc4dce47a596cdda97b9f20a445baf1305516f',
          },
          {
            name: 'LECO_BadHands',
            weight: 0.75,
            hash: 'blake3:4478c707e0e89c250c0897388782b9c926103e9ebbd93f241a1e9c3d0d6d69bf',
          },
          {
            name: '8be1e5d2cc7cd938037337603fb51565',
            weight: 0.45,
            hash: 'blake3:4d12a16bec8fdc0be69ac1ccea9077104f0d61156e21b79a9b09419418c52626',
          },
        ],
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
