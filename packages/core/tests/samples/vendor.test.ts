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
  'yuanbao.png': 'Tencent Yuanbao',
  'gemini_3.1pro-latest.jpg': 'Google Gemini',
  'grok-imagine2.jpg': 'xAI Grok Imagine',
  'dreamina.jpeg': 'ByteDance Dreamina',
  'muse-free.jpg': 'Unknown',
  'muse.webp': 'Meta Muse',
};

/** A PNG without its chunks of one type */
function withoutChunks(png: Uint8Array, type: string): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const kept = [png.subarray(0, 8)];
  for (let pos = 8; pos + 12 <= png.length; ) {
    const end = pos + 12 + view.getUint32(pos);
    const name = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (name !== type) kept.push(png.subarray(pos, end));
    pos = end;
  }
  const result = new Uint8Array(kept.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of kept) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

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

  // yuanbao.png carries no C2PA, only China's AIGC label in the EXIF of the
  // PNG. The label names the provider by a code and no service, so the
  // service shown is the one assumed for Tencent.
  it('yuanbao.png is read from its AIGC label', async () => {
    const result = await parse(loadVendorSample('png', 'yuanbao.png'));
    if (result.status !== 'vendor') throw new Error(result.status);
    expect(result.info.source).toBe('aigc');
    expect(result.info.product).toBeUndefined();
    expect(productLabel(result.info)).toBe('Yuanbao');
    expect(vendorLabels[result.info.vendor]).toBe('Tencent');
  });

  // kling.png carries both a C2PA manifest and the AIGC label as a PNG text
  // chunk; C2PA wins because only it names the service.
  it('kling.png is read from C2PA, not from its AIGC label', async () => {
    const data = loadVendorSample('png', 'kling.png');
    expect(new TextDecoder('latin1').decode(data)).toContain('tEXtAIGC\0{');

    const result = await parse(data);
    expect(result.status === 'vendor' && result.info.source).toBe('c2pa');
  });

  // Converters and platforms may drop the C2PA chunk and keep the text
  // chunk: the label alone still names Kuaishou, but no service.
  it('kling.png without its C2PA chunk is read from the AIGC label', async () => {
    const data = withoutChunks(loadVendorSample('png', 'kling.png'), 'caBX');

    const result = await parse(data);
    expect(result).toEqual({
      status: 'vendor',
      info: { vendor: 'kuaishou', source: 'aigc', media: 'image' },
    });
    expect(stringify(result)).toBe('Kuaishou Kling AI');
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
