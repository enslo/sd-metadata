import { describe, expect, it } from 'vitest';
import { parseNovelAI } from '../../../src/parsers/novelai';
import type { NovelAIMetadata } from '../../../src/types';
import { parseConvertedSample, parsePngSample } from '../helpers';

describe('NovelAI Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse novelai-curated.png', () => {
      const meta = parsePngSample<NovelAIMetadata>(
        'novelai-curated.png',
        parseNovelAI,
      );

      expect(meta).toEqual({
        type: 'novelai',
        software: 'novelai',
        prompt:
          '1girl, solo, hatsune miku, #テスト, very aesthetic, masterpiece, no text, -0.8::feet::, rating:general',
        negativePrompt:
          'blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page',
        width: 1024,
        height: 1024,
        model: undefined,
        sampling: {
          steps: 23,
          cfg: 5,
          seed: 2156638429,
          sampler: 'k_euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        characterPrompts: undefined,
        useCoords: undefined,
        useOrder: undefined,
      });
    });

    it('should parse novelai-full.png', () => {
      const meta = parsePngSample<NovelAIMetadata>(
        'novelai-full.png',
        parseNovelAI,
      );

      expect(meta).toEqual({
        type: 'novelai',
        software: 'novelai',
        prompt:
          '1girl, solo, hatsune miku, #テスト, very aesthetic, masterpiece, no text',
        negativePrompt:
          'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page',
        width: 832,
        height: 1216,
        model: undefined,
        sampling: {
          steps: 28,
          cfg: 5,
          seed: 2043807047,
          sampler: 'k_euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        characterPrompts: undefined,
        useCoords: undefined,
        useOrder: undefined,
      });
    });

    it('should parse novelai-full-3char.png with character prompts', () => {
      const meta = parsePngSample<NovelAIMetadata>(
        'novelai-full-3char.png',
        parseNovelAI,
      );

      expect(meta).toEqual({
        type: 'novelai',
        software: 'novelai',
        prompt:
          '2girls, 1boy, dancing, #テスト\nwhite background, , very aesthetic, masterpiece, no text',
        negativePrompt:
          'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page',
        width: 1024,
        height: 1024,
        model: undefined,
        sampling: {
          steps: 28,
          cfg: 5,
          seed: 1702945580,
          sampler: 'k_euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        characterPrompts: [
          {
            prompt: 'girl, hatsune miku, spread arms, ',
            center: { x: 0.5, y: 0.3 },
          },
          {
            prompt: 'girl, kagamine rin, hand up, ',
            center: { x: 0.7, y: 0.7 },
          },
          {
            prompt: 'boy, kagamine len, hand up, ',
            center: { x: 0.3, y: 0.7 },
          },
        ],
        useCoords: true,
        useOrder: true,
      });
    });
  });

  describe('WebP samples', () => {
    it('should parse novelai-curated.webp', () => {
      const meta = parseConvertedSample<NovelAIMetadata>(
        'webp',
        'novelai-curated.webp',
      );

      expect(meta).toEqual({
        type: 'novelai',
        software: 'novelai',
        prompt:
          '1girl, solo, hatsune miku, #テスト, very aesthetic, masterpiece, no text, -0.8::feet::, rating:general',
        negativePrompt:
          'blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page',
        width: 1024,
        height: 1024,
        model: undefined,
        sampling: {
          steps: 23,
          cfg: 5,
          seed: 880673757,
          sampler: 'k_euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        characterPrompts: undefined,
        useCoords: undefined,
        useOrder: undefined,
      });
    });

    it('should parse novelai-full-3char.webp with character prompts', () => {
      const meta = parseConvertedSample<NovelAIMetadata>(
        'webp',
        'novelai-full-3char.webp',
      );

      expect(meta).toEqual({
        type: 'novelai',
        software: 'novelai',
        prompt:
          '2girls, 1boy, dancing, #テスト\nwhite background, , very aesthetic, masterpiece, no text',
        negativePrompt:
          'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page',
        width: 1024,
        height: 1024,
        model: undefined,
        sampling: {
          steps: 28,
          cfg: 5,
          seed: 447042893,
          sampler: 'k_euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        characterPrompts: [
          {
            prompt: 'girl, hatsune miku, spread arms, ',
            center: { x: 0.5, y: 0.3 },
          },
          {
            prompt: 'girl, kagamine rin, hand up, ',
            center: { x: 0.7, y: 0.7 },
          },
          {
            prompt: 'boy, kagamine len, hand up, ',
            center: { x: 0.3, y: 0.7 },
          },
        ],
        useCoords: true,
        useOrder: true,
      });
    });
  });
});
