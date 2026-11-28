import { describe, expect, it } from 'vitest';
import {
  parse,
  productLabel,
  stringify,
  vendorLabels,
  write,
} from '../../src/index';
import {
  loadSample,
  loadVendorSample,
  VENDOR_SAMPLES,
} from '../helpers/samples';

/**
 * What stringify() returns for each sample: the vendor's company name and
 * the service name from productLabel().
 */
const EXPECTED_TEXT: Record<
  (typeof VENDOR_SAMPLES)[number]['filename'],
  string
> = {
  'chatgpt-image2.png': 'OpenAI GPT Image',
  'chatgpt-image2-latest.png': 'OpenAI GPT Image',
  'gemini_3.1pro.png': 'Google Gemini',
  'gemini_unknown.png': 'Google Gemini',
  'kling.png': 'Kuaishou Kling AI',
  'gemini_3.1pro-latest.jpg': 'Google Gemini',
  'grok-imagine2.jpg': 'xAI Grok Imagine',
  'dreamina.jpeg': 'ByteDance Dreamina',
  'muse-free.jpg': 'Unknown',
  'muse.webp': 'Meta Muse',
};

describe('Vendor detection - real samples', () => {
  for (const { format, filename, info } of VENDOR_SAMPLES) {
    it(`${filename} -> vendor ${JSON.stringify(info)}`, async () => {
      const result = await parse(loadVendorSample(format, filename));

      expect(result).toEqual({ status: 'vendor', info });
      expect(stringify(result)).toBe(EXPECTED_TEXT[filename]);
    });
  }

  // OpenAI declared its service as "gpt-image" and later as "ChatGPT"; the
  // declared value is kept verbatim and productLabel() maps both to the
  // service name.
  it('productLabel() names both ChatGPT generations GPT Image', async () => {
    for (const filename of [
      'chatgpt-image2.png',
      'chatgpt-image2-latest.png',
    ]) {
      const result = await parse(loadVendorSample('png', filename));
      if (result.status !== 'vendor') throw new Error(result.status);
      expect(productLabel(result.info)).toBe('GPT Image');
      expect(vendorLabels[result.info.vendor]).toBe('OpenAI');
    }
  });

  // grok-imagine2.jpg carries both a C2PA manifest and xAI's EXIF signature;
  // C2PA wins because only it names the service.
  it('grok-imagine2.jpg is read from C2PA, not from its signature', async () => {
    const result = await parse(loadVendorSample('jpg', 'grok-imagine2.jpg'));
    expect(result).toEqual({
      status: 'vendor',
      info: {
        vendor: 'xai',
        product: 'Grok Imagine',
        source: 'c2pa',
        media: 'image',
      },
    });
  });

  // Dreamina declares itself as "Dreamina/<app version>"; the declared value
  // is kept verbatim and productLabel() shows the name without the version.
  it('productLabel() names dreamina.jpeg Dreamina, without the app version', async () => {
    const result = await parse(loadVendorSample('jpg', 'dreamina.jpeg'));
    if (result.status !== 'vendor') throw new Error(result.status);
    expect(result.info.product).toBe('Dreamina/7.5.0');
    expect(productLabel(result.info)).toBe('Dreamina');
    expect(vendorLabels[result.info.vendor]).toBe('ByteDance');
  });

  // dreamina.jpeg holds two manifests, Dreamina's and one a ByteDance
  // transcoding service added on top, and neither declares an AI
  // DigitalSourceType: the image is recognized by the tool that created it.
  it('dreamina.jpeg is recognized without an AI DigitalSourceType', async () => {
    const data = loadVendorSample('jpg', 'dreamina.jpeg');
    const text = new TextDecoder('latin1').decode(data);
    expect(text).toContain('ByteDance Media Transcode Service');
    expect(text).not.toContain('AlgorithmicMedia');

    const result = await parse(data);
    expect(result.status).toBe('vendor');
  });

  it('write() refuses to copy a vendor declaration', async () => {
    const result = await parse(loadVendorSample('png', 'chatgpt-image2.png'));
    expect(write(loadSample('png', 'gimp.png'), result)).toEqual({
      ok: false,
      error: {
        type: 'writeFailed',
        message: 'Cannot write vendor (AI service) metadata',
      },
    });
  });
});

describe('Vendor detection - no regressions / no false positives', () => {
  // A normal SD-tool image must keep returning generation metadata.
  it('sd-webui.png still parses as generation metadata (status success)', async () => {
    const result = await parse(loadSample('png', 'sd-webui.png'));
    expect(result.status).toBe('success');
  });

  // A plain non-AI image must not be flagged.
  it('gimp.png (no vendor declaration) is not flagged as vendor', async () => {
    const result = await parse(loadSample('png', 'gimp.png'));
    expect(result.status).not.toBe('vendor');
  });
});
