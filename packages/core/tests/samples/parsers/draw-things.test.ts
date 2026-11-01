import { describe, expect, it } from 'vitest';
import { parseDrawThings } from '../../../src/parsers/draw-things';
import type { StandardMetadata } from '../../../src/types';
import { parsePngSample } from '../helpers';

/**
 * Draw Things sample: SDXL txt2img (Animagine XL 3.1, LCM) with two LoRAs.
 *
 * The whole metadata is one XMP packet in an iTXt chunk, which the convert
 * layer expands into `CreatorTool`, `UserComment` (JSON) and `parameters`
 * (the A1111-like dc:description). The parser reads the JSON: `c`, `uc`,
 * `model`, `sampler`, `scale`, `seed`, `steps`, `strength`, `size`, and the
 * LoRAs from `v2.loras[]` (`file`, `weight`). `scale` and `strength` are
 * single-precision values widened to doubles (1.4 stored as
 * 1.3999999761581421) and come back as the decimal the user set; the
 * top-level `lora[]` list carries the same float32 noise and is not read.
 */
describe('Draw Things Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse draw-things-lora.png', () => {
      const meta = parsePngSample<StandardMetadata>(
        'draw-things-lora.png',
        parseDrawThings,
      );

      expect(meta).toEqual({
        software: 'draw-things',
        prompt:
          '1girl, hatsune miku, holding sign that reads "初音ミク", masterpiece, best quality, very aesthetic, absurdres, safe',
        negativePrompt: '',
        width: 1024,
        height: 1024,
        model: {
          name: 'animagine_xl_v3.1_f16.ckpt',
        },
        sampling: {
          sampler: 'LCM',
          steps: 8,
          cfg: 1.4,
          seed: '1656867057',
          denoise: 1,
        },
        loras: [
          { name: 'surprised_look_slider_lora_f16.ckpt', weight: 0.3 },
          { name: 'dmd2_sdxl_4_step_lora_f16.ckpt', weight: 0.7 },
        ],
        hires: undefined,
        upscale: undefined,
      });
    });
  });
});
