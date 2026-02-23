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
          seed: 2083100758,
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
          seed: 733776228,
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
          seed: 1741309074,
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
          seed: 697543491,
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
          seed: 830680752,
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
