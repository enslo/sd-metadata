import { describe, expect, it } from 'vitest';
import { productLabel, type Vendor, vendorLabels } from '../../../src/index';

describe('productLabel', () => {
  it('maps the product values vendors declare to service names', () => {
    expect(
      productLabel({
        vendor: 'openai',
        product: 'gpt-image',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('GPT Image');
    expect(
      productLabel({
        vendor: 'openai',
        product: 'ChatGPT',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('GPT Image');
    expect(
      productLabel({
        vendor: 'openai',
        product: 'Sora',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Sora');
    expect(
      productLabel({
        vendor: 'xai',
        product: 'Grok Imagine',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Grok Imagine');
  });

  it("falls back to the vendor's main image service without a product", () => {
    expect(
      productLabel({ vendor: 'openai', source: 'c2pa', media: 'image' }),
    ).toBe('GPT Image');
    expect(
      productLabel({ vendor: 'google', source: 'c2pa', media: 'image' }),
    ).toBe('Gemini');
    expect(
      productLabel({ vendor: 'xai', source: 'signature', media: 'image' }),
    ).toBe('Grok Imagine');
    expect(
      productLabel({ vendor: 'meta', source: 'xmp', media: 'image' }),
    ).toBe('Muse');
    expect(
      productLabel({ vendor: 'kuaishou', source: 'c2pa', media: 'image' }),
    ).toBe('Kling AI');
    expect(
      productLabel({ vendor: 'bytedance', source: 'c2pa', media: 'image' }),
    ).toBe('Dreamina');
    expect(
      productLabel({ vendor: 'tencent', source: 'aigc', media: 'image' }),
    ).toBe('Yuanbao');
  });

  it('returns an unknown product value as written', () => {
    expect(
      productLabel({
        vendor: 'openai',
        product: 'New Service',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('New Service');
    expect(
      productLabel({
        vendor: 'google',
        product: 'Imagen',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Imagen');
  });

  it('shows a product declared as name/version by its name', () => {
    expect(
      productLabel({
        vendor: 'bytedance',
        product: 'Dreamina/7.5.0',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Dreamina');
    expect(
      productLabel({
        vendor: 'unknown',
        product: 'Some Tool/12.0.1-beta',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Some Tool');
  });

  it('keeps a slash that is not followed by a version', () => {
    expect(
      productLabel({
        vendor: 'unknown',
        product: 'Text/Image Studio',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Text/Image Studio');
    expect(
      productLabel({
        vendor: 'unknown',
        product: 'Studio/',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Studio/');
  });

  it('does not resolve product values through the prototype chain', () => {
    expect(
      productLabel({
        vendor: 'openai',
        product: 'constructor',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('constructor');
  });

  it('reports an unknown vendor by its product, or as Unknown without one', () => {
    expect(
      productLabel({ vendor: 'unknown', source: 'xmp', media: 'image' }),
    ).toBe('Unknown');
    expect(
      productLabel({
        vendor: 'unknown',
        product: 'Sora',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Sora');
  });
});

describe('vendorLabels', () => {
  it('names each vendor by company', () => {
    expect(vendorLabels).toEqual({
      openai: 'OpenAI',
      google: 'Google',
      xai: 'xAI',
      meta: 'Meta',
      kuaishou: 'Kuaishou',
      bytedance: 'ByteDance',
      tencent: 'Tencent',
      unknown: 'Unknown',
    });
  });
});

describe('productLabel - videos', () => {
  it("falls back to the vendor's main video service without a product", () => {
    const video = (vendor: Vendor) =>
      productLabel({ vendor, source: 'c2pa', media: 'video' });
    expect(video('openai')).toBe('Sora');
    expect(video('google')).toBe('Veo');
    expect(video('xai')).toBe('Grok Imagine');
    expect(video('meta')).toBe('Muse');
    expect(video('kuaishou')).toBe('Kling AI');
    expect(video('bytedance')).toBe('Dreamina');
    expect(video('tencent')).toBe('Yuanbao');
    expect(video('unknown')).toBe('Unknown');
  });

  it('maps a declared product the same way as for images', () => {
    expect(
      productLabel({
        vendor: 'openai',
        product: 'Sora',
        source: 'c2pa',
        media: 'video',
      }),
    ).toBe('Sora');
  });
});
