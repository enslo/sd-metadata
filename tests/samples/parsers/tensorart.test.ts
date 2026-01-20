import { describe, expect, it } from 'vitest';
import { parseTensorArt } from '../../../src/parsers/tensorart';
import type { ComfyUIMetadata } from '../../../src/types';
import { expectComfyNodeGraph } from '../../helpers/comfy-node-graph';
import { parsePngSample } from '../helpers';

describe('TensorArt Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse tensorart.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'tensorart.png',
        parseTensorArt,
      );

      expect(meta).toEqual({
        software: 'tensorart',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'WAI-Nsfw-Illustrious-16',
          hash: 'A5F58EB1C33616C4F06BCA55AF39876A7B817913CD829CAA8ACB111B770C85CC',
        },
        sampling: {
          seed: 3036459311,
          steps: 25,
          cfg: 7,
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });
  });
});
