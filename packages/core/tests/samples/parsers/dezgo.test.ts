import { describe, expect, it } from 'vitest';
import { parseDezgo } from '../../../src/parsers/dezgo';
import type { StandardMetadata } from '../../../src/types';
import { parseConvertedSample, parsePngSample } from '../helpers';

const LORA_HASH =
  '59D5706A66379263F4756C28E8EBF5573EE03E50E9A317B827C9B99236E0C901';

describe('Dezgo Parser - Samples', () => {
  describe('PNG samples (GenInfo JSON)', () => {
    it('should parse dezgo.png', () => {
      const meta = parsePngSample<StandardMetadata>('dezgo.png', parseDezgo);

      expect(meta).toEqual({
        software: 'dezgo',
        prompt:
          'general, masterpiece, \n1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt: '',
        width: 768,
        height: 768,
        model: { name: 'illustrious_hassaku_xl_1024px' },
        sampling: {
          sampler: 'euler_a',
          steps: 20,
          cfg: 5.5,
          seed: '732102538',
        },
      });
    });

    it('should parse dezgo-lora.png with its LoRA hash', () => {
      const meta = parsePngSample<StandardMetadata>(
        'dezgo-lora.png',
        parseDezgo,
      );

      expect(meta).toEqual({
        software: 'dezgo',
        prompt: 'masterpiece, 1girl, solo, hatsune miku, #テスト',
        negativePrompt: 'worst quality, bad quality,',
        width: 768,
        height: 768,
        model: { name: 'illustrious_hassaku_xl_1024px' },
        sampling: {
          sampler: 'auto',
          steps: 20,
          cfg: 5,
          seed: '473784644',
        },
        // Dezgo records only the CivitAI SHA-256 of a LoRA, so it is the name too
        loras: [{ name: LORA_HASH, hash: LORA_HASH, weight: 0.6 }],
      });
    });
  });

  describe('JPEG/WebP samples (UserComment YAML)', () => {
    it('should parse dezgo.jpg with a single-quoted prompt', () => {
      const meta = parseConvertedSample<StandardMetadata>('jpeg', 'dezgo.jpg');

      expect(meta).toEqual({
        software: 'dezgo',
        prompt: 'masterpiece, 1girl, solo, hatsune miku, #テスト',
        negativePrompt: '',
        width: 768,
        height: 768,
        model: { name: 'illustrious_hassaku_xl_1024px' },
        sampling: {
          sampler: 'dpmpp_2m_karras',
          steps: 20,
          cfg: 3.9,
          seed: '1387424452',
        },
      });
    });

    it('should parse dezgo.webp with a folded multi-line prompt', () => {
      const meta = parseConvertedSample<StandardMetadata>('webp', 'dezgo.webp');

      expect(meta).toEqual({
        software: 'dezgo',
        prompt:
          'general, masterpiece, \n1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt: '',
        width: 768,
        height: 768,
        model: { name: 'illustrious_hassaku_xl_1024px' },
        sampling: {
          sampler: 'ddim',
          steps: 20,
          cfg: 3.9,
          seed: '2021770285',
        },
      });
    });

    it('should parse dezgo-long.jpg with a long plain prompt on one line', () => {
      // Dezgo does not wrap long values: 147 characters stay on one line
      const meta = parseConvertedSample<StandardMetadata>(
        'jpeg',
        'dezgo-long.jpg',
      );

      expect(meta).toEqual({
        software: 'dezgo',
        prompt:
          'general, masterpiece, best quality, amazing quality, very aesthetic, 1girl, solo, hatsune miku, smile, open mouth, one eye closed, double v,',
        negativePrompt: '',
        width: 768,
        height: 768,
        model: { name: 'illustrious_hassaku_xl_1024px' },
        sampling: {
          sampler: 'euler_a',
          steps: 20,
          cfg: 5.5,
          seed: '1680019219',
        },
      });
    });

    it('should parse dezgo-long.webp with a double-quoted prompt', () => {
      // Lines ending in a space before a line break are written double-quoted
      // with \n escapes
      const meta = parseConvertedSample<StandardMetadata>(
        'webp',
        'dezgo-long.webp',
      );

      expect(meta).toEqual({
        software: 'dezgo',
        prompt:
          'general, masterpiece, best quality, amazing quality, very aesthetic, 1girl, solo, hatsune miku, \nstanding, contrappost, smile, open mouth, one eye closed, double v, light blush, wink star, \non roof, wind, floating hair, cityscape, blue sky, day, sunlight, ',
        negativePrompt: '',
        width: 768,
        height: 768,
        model: { name: 'illustrious_hassaku_xl_1024px' },
        sampling: {
          sampler: 'euler_a',
          steps: 20,
          cfg: 5.5,
          seed: '1898249893',
        },
      });
    });
  });
});
