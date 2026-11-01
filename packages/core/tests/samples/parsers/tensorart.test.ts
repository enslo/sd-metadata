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
          seed: '3036459311',
          steps: 25,
          cfg: 7,
          clipSkip: 2,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse tensorart-lora.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'tensorart-lora.png',
        parseTensorArt,
      );

      // LoRAs come from `generation_data.models` entries of type "LORA":
      // `modelFileName` (upload name), `weight` and the sha256 `hash`. The
      // node graph names the same files `EMS-<id>-EMS.safetensors` in a
      // LoraTagLoader tag, which is not read here.
      expect(meta).toEqual({
        software: 'tensorart',
        prompt:
          'general, masterpiece, best quality, amazing quality, xiushou, \n1girl, solo, hatsune miku, double v, #テスト /* コメント */',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch,censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'WAI-Nsfw-Illustrious-17',
          hash: 'F116B0C78FF441467B0CDC8F1936E1ED18EA31E9997C7B132B1B8DB533F0BD04',
        },
        sampling: {
          seed: '890135287',
          steps: 20,
          cfg: 5,
          clipSkip: 2,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
        },
        loras: [
          {
            name: 'lora.by_tusi',
            weight: 0.2,
            hash: 'FCE04DA765FEFD716AAB4CA967D51D1E8B20E35DC9486C1C14C9A187320130CC',
          },
          {
            name: 'lighting_v2',
            weight: 0.4,
            hash: 'F79B58EA61E84430559638FD1A0D93B6F995F7F08CB7D8541D44FA392D027D63',
          },
          {
            name: 'Detail_enhancer_IL_v2',
            weight: 0.25,
            hash: '54A203F0A909FDC9B1D74F29FD5A16E33387A824D7D2161322F4DB3EA250455E',
          },
        ],
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });
  });
});
