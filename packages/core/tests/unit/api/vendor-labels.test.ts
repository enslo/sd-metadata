import { describe, expect, it } from 'vitest';
import { productLabel, vendorLabels } from '../../../src/index';

describe('productLabel', () => {
  it('maps the product values vendors declare to service names', () => {
    expect(
      productLabel({ vendor: 'openai', product: 'gpt-image', source: 'c2pa' }),
    ).toBe('GPT Image');
    expect(
      productLabel({ vendor: 'openai', product: 'ChatGPT', source: 'c2pa' }),
    ).toBe('GPT Image');
    expect(
      productLabel({ vendor: 'openai', product: 'Sora', source: 'c2pa' }),
    ).toBe('Sora');
    expect(
      productLabel({ vendor: 'xai', product: 'Grok Imagine', source: 'c2pa' }),
    ).toBe('Grok Imagine');
  });

  it("falls back to the vendor's main image service without a product", () => {
    expect(productLabel({ vendor: 'openai', source: 'c2pa' })).toBe(
      'GPT Image',
    );
    expect(productLabel({ vendor: 'google', source: 'c2pa' })).toBe('Gemini');
    expect(productLabel({ vendor: 'xai', source: 'signature' })).toBe(
      'Grok Imagine',
    );
    expect(productLabel({ vendor: 'meta', source: 'xmp' })).toBe('Muse');
  });

  it('returns an unknown product value as written', () => {
    expect(
      productLabel({
        vendor: 'openai',
        product: 'New Service',
        source: 'c2pa',
      }),
    ).toBe('New Service');
    expect(
      productLabel({ vendor: 'google', product: 'Imagen', source: 'c2pa' }),
    ).toBe('Imagen');
  });

  it('does not resolve product values through the prototype chain', () => {
    expect(
      productLabel({
        vendor: 'openai',
        product: 'constructor',
        source: 'c2pa',
      }),
    ).toBe('constructor');
  });

  it('reports an unknown vendor by its product, or as Unknown without one', () => {
    expect(productLabel({ vendor: 'unknown', source: 'xmp' })).toBe('Unknown');
    expect(
      productLabel({ vendor: 'unknown', product: 'Sora', source: 'c2pa' }),
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
      unknown: 'Unknown',
    });
  });
});
