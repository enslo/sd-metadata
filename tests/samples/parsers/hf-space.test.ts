import { describe, expect, it } from 'vitest';
import { parseHfSpace } from '../../../src/parsers/hf-space';
import type { A1111Metadata } from '../../../src/types';
import { parsePngSample } from '../helpers';

describe('HF-Space Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse huggingface-animagine.png', () => {
      const meta = parsePngSample<A1111Metadata>(
        'huggingface-animagine.png',
        parseHfSpace,
      );

      expect(meta).toEqual({
        type: 'a1111',
        software: 'hf-space',
        prompt:
          '1girl, souryuu asuka langley, neon genesis evangelion, eyepatch, red plugsuit, sitting, on throne, crossed legs, head tilt, holding weapon, lance of longinus \\\\(evangelion\\\\), cowboy shot, depth of field, faux traditional media, painterly, impressionism, photo background, masterpiece, high score, great score, absurdres',
        negativePrompt:
          'lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry',
        width: 832,
        height: 1216,
        model: {
          name: 'Animagine XL 4.0',
          hash: '6327eca98b',
        },
        sampling: {
          sampler: 'Euler a',
          seed: 1409714424,
          steps: 28,
          cfg: 5,
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
