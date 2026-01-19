import { describe, expect, it } from 'vitest';
import { parseRuinedFooocus } from '../../../src/parsers/ruined-fooocus';
import type { A1111Metadata } from '../../../src/types';
import { parsePngSample } from '../helpers';

describe('Ruined Fooocus Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse ruined-fooocus.png', () => {
      const meta = parsePngSample<A1111Metadata>(
        'ruined-fooocus.png',
        parseRuinedFooocus,
      );

      expect(meta).toEqual({
        software: 'ruined-fooocus',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiNSFWIllustrious_v150.safetensors',
          hash: 'BEFC694A296F75E996488EBF9F9DB8A1493BD059B6E704B975829E87D5AEB4FA',
        },
        sampling: {
          sampler: 'dpmpp_2m_sde_gpu',
          scheduler: 'karras',
          seed: 2020047614,
          steps: 30,
          cfg: 8,
          clipSkip: 1,
        },
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
