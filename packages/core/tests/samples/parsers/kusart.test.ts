import { describe, expect, it } from 'vitest';
import { parseKusArt } from '../../../src/parsers/kusart';
import type { StandardMetadata } from '../../../src/types';
import { parsePngSample } from '../helpers';

// Every sample was generated from the prompt "1girl, solo, hatsune_miku,
// #テスト" with the negative prompt "kasane_teto," where the model has one.
// KusArt records the prompts after its styles added their tags, and records
// neither img2img nor the style enhancement option.

describe('KusArt Parser - Samples', () => {
  it('should parse kusart-xl.png with the tags of its forced style', () => {
    // Kusa-XL always applies a style; 14 is the one selected by default
    const meta = parsePngSample<StandardMetadata>('kusart-xl.png', parseKusArt);

    expect(meta).toEqual({
      software: 'kusart',
      prompt:
        'caststation illu, 1girl, solo, hatsune_miku, #テスト, masterpiece, best quality, amazing quality, highres, newest',
      negativePrompt:
        'kasane_teto,, nsfw,worst quality, normal quality, old,, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry,hairband,, lowres,(bad),text,error,fewer,extra,missing,worst quality,jpeg artifacts,low quality,watermark,unfinished,displeasing,oldest,early,chromatic aberration,signature,extra digits,artistic error,username,scan,[abstract],',
      width: 1024,
      height: 1024,
      model: { name: 'Kusa-XL' },
      // style_id carries no strength
      loras: [{ name: 'Style 14' }],
    });
  });

  it('should parse kusart-easy-3styles.png with each of its styles', () => {
    // Kusa-Easy styles add no tags to the prompts
    const meta = parsePngSample<StandardMetadata>(
      'kusart-easy-3styles.png',
      parseKusArt,
    );

    expect(meta).toEqual({
      software: 'kusart',
      prompt: '1girl, solo, hatsune_miku, #テスト',
      negativePrompt: 'kasane_teto,',
      width: 1024,
      height: 1024,
      model: { name: 'Kusa-Easy' },
      // KusArt shows style 101 as "Style E-05"; only the ID is recorded
      loras: [
        { name: 'Style 101', weight: 1 },
        { name: 'Style 115', weight: 1 },
        { name: 'Style 156', weight: 1 },
      ],
    });
  });

  it('should parse kusart-anima.png without a negative prompt', () => {
    // Kusa-Anima records no style even when one is applied
    const meta = parsePngSample<StandardMetadata>(
      'kusart-anima.png',
      parseKusArt,
    );

    expect(meta).toEqual({
      software: 'kusart',
      prompt: '1girl, solo, hatsune_miku, #テスト',
      negativePrompt: '',
      width: 1024,
      height: 1024,
      model: { name: 'Kusa-Anima' },
    });
  });

  it('should parse kusart-krea2.png, whose model takes no negative prompt', () => {
    const meta = parsePngSample<StandardMetadata>(
      'kusart-krea2.png',
      parseKusArt,
    );

    expect(meta).toEqual({
      software: 'kusart',
      prompt: '1girl, solo, hatsune_miku, #テスト',
      negativePrompt: '',
      width: 1024,
      height: 1024,
      model: { name: 'Kusa-Krea2' },
    });
  });
});
