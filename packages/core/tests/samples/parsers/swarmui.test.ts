import { describe, expect, it } from 'vitest';
import { parseSwarmUI } from '../../../src/parsers/swarmui';
import type { ComfyUIMetadata } from '../../../src/types';
import { expectComfyNodeGraph } from '../../helpers/comfy-node-graph';
import { parseConvertedSample, parsePngSample } from '../helpers';

describe('SwarmUI Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse swarmui.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>('swarmui.png', parseSwarmUI);

      expect(meta).toEqual({
        software: 'swarmui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
        },
        sampling: {
          seed: '2083100758',
          steps: 20,
          cfg: 7,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse swarmui-hires.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'swarmui-hires.png',
        parseSwarmUI,
      );

      expect(meta).toEqual({
        software: 'swarmui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 768,
        height: 768,
        model: {
          name: 'waiIllustriousSDXL_v160',
        },
        sampling: {
          seed: '733776228',
          steps: 20,
          cfg: 7,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: {
          scale: 1.5,
          upscaler: 'model-RealESRGAN_x4plus_anime_6B.pth',
          denoise: 0.3,
        },
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse swarmui-upscale.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'swarmui-upscale.png',
        parseSwarmUI,
      );

      expect(meta).toEqual({
        software: 'swarmui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1536,
        height: 1536,
        model: {
          name: 'waiIllustriousSDXL_v160',
        },
        sampling: {
          seed: '1741309074',
          steps: 20,
          cfg: 7,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse swarmui-lora.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'swarmui-lora.png',
        parseSwarmUI,
      );

      // SwarmUI 0.9.8.4: three LoRAs from `loras` / `loraweights` (weights
      // written as text), hashes matched from `sui_models` by file name.
      // This file carries no `prompt` node graph and no sampler keys.
      expect(meta).toEqual({
        software: 'swarmui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170',
        },
        sampling: {
          seed: '555551940',
          steps: 20,
          cfg: 4.5,
        },
        loras: [
          {
            name: '8be1e5d2cc7cd938037337603fb51565',
            weight: 0.6,
            hash: '0x9af2184c4a387752c4d86440598b0ea059257165ae0c71a683e4f5fcc16b0050',
          },
          {
            name: 'LECO_BadHands',
            weight: -0.5,
            hash: '0x3ad0c6f3d319419328965c058b40f5d230dcb1145e4c0b8951100f5e68002099',
          },
          {
            name: 'LECO_GoodHands',
            weight: 0.6,
            hash: '0xc5a540231a576a044587c37f1fe704390587a07303313d7f0612382d08606925',
          },
        ],
        hires: undefined,
        upscale: undefined,
        nodes: undefined,
      });
    });
  });

  describe('JPEG samples', () => {
    it('should parse swarmui.jpg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>('jpeg', 'swarmui.jpg');

      expect(meta).toEqual({
        software: 'swarmui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
        },
        sampling: {
          seed: '697543491',
          steps: 20,
          cfg: 7,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });

  describe('WebP samples', () => {
    it('should parse swarmui.webp', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'webp',
        'swarmui.webp',
      );

      expect(meta).toEqual({
        software: 'swarmui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160',
        },
        sampling: {
          seed: '830680752',
          steps: 20,
          cfg: 7,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
