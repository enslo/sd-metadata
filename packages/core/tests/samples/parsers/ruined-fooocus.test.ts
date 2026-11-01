import { describe, expect, it } from 'vitest';
import { parseRuinedFooocus } from '../../../src/parsers/ruined-fooocus';
import type { StandardMetadata } from '../../../src/types';
import { parsePngSample } from '../helpers';

describe('Ruined Fooocus Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse ruined-fooocus.png', () => {
      const meta = parsePngSample<StandardMetadata>(
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
          seed: '2020047614',
          steps: 30,
          cfg: 8,
          clipSkip: 1,
        },
        hires: undefined,
        upscale: undefined,
      });
    });

    it('should parse ruined-fooocus-lora.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'ruined-fooocus-lora.png',
        parseRuinedFooocus,
      );

      // `loras` entries are `[sha256, "weight - path"]`; the path below the
      // LoRA folder is kept as written, the hash is "" for files RuinedFooocus
      // has not hashed yet. `base_model_hash` is null here and left out.
      expect(meta).toEqual({
        software: 'ruined-fooocus',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          sampler: 'dpmpp_2m_sde_gpu',
          scheduler: 'karras',
          seed: '1794310204',
          steps: 30,
          cfg: 8,
          clipSkip: 1,
        },
        loras: [
          { name: 'Lora\\LECO_GoodHands.safetensors', weight: 0.05 },
          { name: 'Lora\\LECO_BadHands.safetensors', weight: 0.65 },
          {
            name: 'Lora\\8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.75,
            hash: 'FED2FF2EF9C09C5F01732F051CB8F1C9A00FCA8655E0DA43BD4EBB3F2706517F',
          },
        ],
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
