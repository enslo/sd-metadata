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
          seed: 3951921344,
          steps: 24,
          cfg: 6,
          sampler: 'euler_a',
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
