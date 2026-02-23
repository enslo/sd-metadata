import { describe, expect, it } from 'vitest';
import { parseHfSpace } from '../../../src/parsers/hf-space';
import type { StandardMetadata } from '../../../src/types';
import { parsePngSample } from '../helpers';

describe('HF-Space Parsers - Samples', () => {
  describe('PNG samples - upscale', () => {
    it('should parse huggingface-space-upscale.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'huggingface-space-upscale.png',
        parseHfSpace,
      );

      expect(meta).toEqual({
        software: 'hf-space',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'WAI NSFW illustrious SDXL v16',
          hash: 'BDB59BAC77D94AE7A55FF893170F9554C3F349E48A1B73C0C17C0B7C6F4D41A2',
        },
        sampling: {
          sampler: 'DPM++ 2M Karras',
          seed: 1971450810,
          steps: 20,
          cfg: 5.5,
        },
        hires: {
          upscaler: 'nearest-exact',
          denoise: 0.7,
          scale: 1.5,
        },
      });
    });
  });

  describe('PNG samples', () => {
    it('should parse huggingface-space.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'huggingface-space.png',
        parseHfSpace,
      );

      expect(meta).toEqual({
        software: 'hf-space',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'WAI NSFW illustrious SDXL v16',
          hash: 'BDB59BAC77D94AE7A55FF893170F9554C3F349E48A1B73C0C17C0B7C6F4D41A2',
        },
        sampling: {
          sampler: 'DPM++ 2M Karras',
          seed: 443800072,
          steps: 24,
          cfg: 5.5,
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
