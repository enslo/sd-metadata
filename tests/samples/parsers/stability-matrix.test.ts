import { describe, expect, it } from 'vitest';
import { parseStabilityMatrix } from '../../../src/parsers/stability-matrix';
import type { ComfyUIMetadata } from '../../../src/types';
import { expectComfyNodeGraph } from '../../helpers/comfy-node-graph';
import { parsePngSample } from '../helpers';

describe('Stability Matrix Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse stability-matrix.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'stability-matrix.png',
        parseStabilityMatrix,
      );

      expect(meta).toEqual({
        software: 'stability-matrix',
        prompt:
          'general, masterpiece, best quality, amazing quality, \r\n1girl, solo, hatsune miku, #テスト\r\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \r\n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
          hash: 'A5F58EB1C33616C4F06BCA55AF39876A7B817913CD829CAA8ACB111B770C85CC',
        },
        sampling: {
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          seed: 395309383,
          cfg: 5,
          steps: 20,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse stability-matrix-hires.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'stability-matrix-hires.png',
        parseStabilityMatrix,
      );

      expect(meta).toEqual({
        software: 'stability-matrix',
        prompt:
          'general, masterpiece, best quality, amazing quality, \r\n1girl, solo, hatsune miku, #テスト\r\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \r\n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
          hash: 'A5F58EB1C33616C4F06BCA55AF39876A7B817913CD829CAA8ACB111B770C85CC',
        },
        sampling: {
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          seed: 2073041550,
          steps: 20,
          cfg: 5,
        },
        hires: {
          scale: 1.5,
          upscaler: 'RealESRGAN_x4plus_anime_6B.pth',
          steps: 10,
          denoise: 0.2958477508650519,
        },
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse stability-matrix-upscale.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'stability-matrix-upscale.png',
        parseStabilityMatrix,
      );

      expect(meta).toEqual({
        software: 'stability-matrix',
        prompt:
          'general, masterpiece, best quality, amazing quality, \r\n1girl, solo, hatsune miku, #テスト\r\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \r\n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
          hash: 'A5F58EB1C33616C4F06BCA55AF39876A7B817913CD829CAA8ACB111B770C85CC',
        },
        sampling: {
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          seed: 963022979,
          steps: 20,
          cfg: 5,
        },
        hires: undefined,
        upscale: {
          upscaler: 'SwinIR_4x.pth',
          scale: 1.5,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });
  });
});
