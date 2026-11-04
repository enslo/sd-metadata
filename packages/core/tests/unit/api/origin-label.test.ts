import { describe, expect, it } from 'vitest';
import type {
  GenerationMetadata,
  ParseResult,
  VendorInfo,
  VideoParseResult,
} from '../../../src/index';
import { originLabel, stringify } from '../../../src/index';

const novelai: GenerationMetadata = {
  software: 'novelai',
  prompt: 'masterpiece, 1girl',
  negativePrompt: 'lowres',
  width: 832,
  height: 1216,
};

const comfyui: GenerationMetadata = {
  software: 'comfyui',
  prompt: 'a cat walking on the beach',
  negativePrompt: '',
  width: 1280,
  height: 720,
  nodes: {},
};

const grok: VendorInfo = {
  vendor: 'xai',
  product: 'Grok Imagine',
  source: 'c2pa',
  media: 'image',
};

const unknownVendor: VendorInfo = {
  vendor: 'unknown',
  source: 'xmp',
  media: 'image',
};

describe('originLabel', () => {
  it('names a success result by its generation software', () => {
    const result: ParseResult = {
      status: 'success',
      metadata: novelai,
      raw: { format: 'png', chunks: [] },
    };
    expect(originLabel(result)).toBe('NovelAI');
    expect(originLabel(novelai)).toBe('NovelAI');
  });

  it('names a vendor result by the company and its service', () => {
    expect(originLabel({ status: 'vendor', info: grok })).toBe(
      'xAI Grok Imagine',
    );
    expect(originLabel(grok)).toBe('xAI Grok Imagine');
    expect(
      originLabel({ vendor: 'google', source: 'c2pa', media: 'image' }),
    ).toBe('Google Gemini');
  });

  it('leaves the service alone when the vendor is unknown', () => {
    expect(originLabel(unknownVendor)).toBe('Unknown');
    expect(originLabel({ ...unknownVendor, product: 'Sora' })).toBe('Sora');
  });

  it('accepts video results', () => {
    const result: VideoParseResult = {
      status: 'success',
      metadata: comfyui,
      raw: { format: 'mp4', tags: [] },
    };
    expect(originLabel(result)).toBe('ComfyUI');
    expect(
      originLabel({
        status: 'vendor',
        info: { vendor: 'google', source: 'c2pa', media: 'video' },
      }),
    ).toBe('Google Veo');
  });

  it('returns an empty string when there is nothing to name', () => {
    expect(originLabel({ status: 'empty' })).toBe('');
    expect(originLabel({ status: 'invalid', message: 'Not an image' })).toBe(
      '',
    );
    expect(
      originLabel({
        status: 'unrecognized',
        raw: { format: 'jpeg', segments: [] },
      }),
    ).toBe('');
  });

  it('matches stringify() for vendor results', () => {
    const infos: VendorInfo[] = [
      grok,
      unknownVendor,
      { ...unknownVendor, product: 'Sora' },
      { vendor: 'meta', source: 'xmp', media: 'video' },
    ];
    for (const info of infos) {
      const result: ParseResult = { status: 'vendor', info };
      expect(originLabel(result)).toBe(stringify(result));
    }
  });
});
