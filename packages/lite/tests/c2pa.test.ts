import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../src/index';
import { readJpeg, readPng } from '../src/read';

const SAMPLES = join(import.meta.dirname, '../../../samples');

function load(file: string, format = 'png'): Uint8Array {
  return new Uint8Array(readFileSync(join(SAMPLES, 'vendor', format, file)));
}

function loadPng(file: string): Uint8Array {
  return new Uint8Array(readFileSync(join(SAMPLES, 'png', file)));
}

describe('C2PA Content Credentials detection', () => {
  // For images with no A1111 parameters, parse() returns a name from the
  // C2PA manifest, the only human-readable provenance signal these exports
  // carry: the tool an action names as its software agent, else the program
  // that generated the claim.
  it('returns the tool a ChatGPT image names, as written at the time', () => {
    // OpenAI declared its service as "gpt-image" and later as "ChatGPT"
    expect(parse(load('chatgpt-image2.png'))).toBe('gpt-image');
    expect(parse(load('chatgpt-image2-latest.png'))).toBe('ChatGPT');
  });

  // Kling's claim generator is "ks-c2pa-service", which does not say Kling;
  // its created action does.
  it('returns the tool a Kling image names rather than its claim generator', () => {
    expect(parse(load('kling.png'))).toBe('Kling AI');
  });

  // Gemini names no software agent, so the claim generator stands in.
  it('returns the Google generator name for a Gemini image', () => {
    expect(parse(load('gemini_3.1pro.png'))).toBe(
      'Google C2PA Core Generator Library',
    );
  });

  // gemini_unknown carries a structurally identical manifest (model is not
  // recoverable from metadata), so it yields the same generator name.
  it('returns the same generator name for an unlabelled Gemini image', () => {
    expect(parse(load('gemini_unknown.png'))).toBe(
      'Google C2PA Core Generator Library',
    );
  });
});

describe('C2PA Content Credentials detection - JPEG APP11', () => {
  it('returns the Google generator name for a Gemini JPEG', () => {
    expect(parse(load('gemini_3.1pro-latest.jpg', 'jpg'))).toBe(
      'Google C2PA Core Generator Library',
    );
  });

  // grok-imagine2.jpg also writes xAI's "Signature: <base64>" into EXIF
  // UserComment / ImageDescription; the C2PA generator name is preferred.
  it('returns the Grok generator name rather than its EXIF signature', () => {
    expect(parse(load('grok-imagine2.jpg', 'jpg'))).toBe('Grok Imagine');
  });

  // Dreamina writes its claim_generator_info as null; the tool is named by
  // the created action, with the app version.
  it('returns the tool a Dreamina JPEG names, although it has no generator info', () => {
    expect(parse(load('dreamina.jpeg', 'jpg'))).toBe('Dreamina/7.5.0');
  });

  // Yuanbao carries no C2PA, only China's AIGC label, which lite does not
  // read.
  it('returns empty for the Yuanbao image, labelled without C2PA', () => {
    expect(parse(load('yuanbao.png'))).toBe('');
  });

  // Muse declares itself only in XMP, which lite does not read.
  it('returns empty for the XMP-only Muse images', () => {
    expect(parse(load('muse-free.jpg', 'jpg'))).toBe('');
    expect(parse(load('muse.webp', 'webp'))).toBe('');
  });

  it('records no cabx entry for a JPEG without APP11', () => {
    const jpeg = new Uint8Array(
      readFileSync(join(SAMPLES, 'jpg', 'sd-webui.jpg')),
    );
    expect(readJpeg(jpeg).cabx).toBeUndefined();
  });
});

describe('C2PA detection - no false positives', () => {
  // A normal SD-tool PNG must keep yielding A1111 generation text; the C2PA
  // fallback only fires when extract() returns nothing.
  it('still returns A1111 text for a Stable Diffusion WebUI image', () => {
    expect(parse(loadPng('sd-webui.png'))).toContain('Steps:');
  });

  // PNGs without a caBX chunk must not get a `cabx` entry, regardless of any
  // other text metadata they hold.
  it('records no cabx entry for a PNG without a caBX chunk', () => {
    expect(readPng(loadPng('sd-webui.png')).cabx).toBeUndefined();
    expect(readPng(loadPng('gimp.png')).cabx).toBeUndefined();
  });
});

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Build a minimal PNG carrying a single caBX chunk with the given body.
function pngWithCaBX(body: number[]): Uint8Array {
  const len = body.length;
  return new Uint8Array([
    ...SIGNATURE,
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    0x63,
    0x61,
    0x42,
    0x58, // "caBX"
    ...body,
    0,
    0,
    0,
    0, // CRC (ignored)
  ]);
}

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/** A CBOR text string of up to 23 characters: 0x60 + length, then the text. */
const cborText = (text: string): number[] => [
  0x60 + text.length,
  ...ascii(text),
];

// Encode "claim_generator_info" + the "name" CBOR key ("dname") prefix so the
// tests exercise the value-decoding path directly.
function manifest(valueBytes: number[]): number[] {
  return [...ascii('claim_generator_info'), ...ascii('dname'), ...valueBytes];
}

describe('C2PA detection - software agent', () => {
  const generator = manifest(cborText('signing-service'));

  it('reads a software agent written as a text', () => {
    const body = [
      ...ascii('softwareAgent'),
      ...cborText('Grok Imagine'),
      ...generator,
    ];
    expect(parse(pngWithCaBX(body))).toBe('Grok Imagine');
  });

  it('reads the name of a software agent written as a map', () => {
    // 0xa1 = map of one pair: { name: "Kling AI" }
    const body = [
      ...ascii('softwareAgent'),
      0xa1,
      ...ascii('dname'),
      ...cborText('Kling AI'),
      ...generator,
    ];
    expect(parse(pngWithCaBX(body))).toBe('Kling AI');
  });

  it('falls back to the claim generator when the agent map does not start with a name', () => {
    // { version: "1.0", ... }: the "dname" that follows later belongs to
    // the claim generator, not to the agent
    const body = [
      ...ascii('softwareAgent'),
      0xa1,
      ...ascii('gversion'),
      ...cborText('1.0'),
      ...generator,
    ];
    expect(parse(pngWithCaBX(body))).toBe('signing-service');
  });

  it('falls back to the claim generator when the agent is neither text nor map', () => {
    // 0xf6 = null
    const body = [...ascii('softwareAgent'), 0xf6, ...generator];
    expect(parse(pngWithCaBX(body))).toBe('signing-service');
  });

  it('returns empty when the manifest names neither', () => {
    expect(parse(pngWithCaBX(ascii('c2pa.actions without names')))).toBe('');
  });
});

describe('C2PA detection - malformed input safety', () => {
  it('reads a well-formed inline CBOR text string', () => {
    // 0x64 = text string of length 4, followed by "test".
    const body = manifest([0x64, 0x74, 0x65, 0x73, 0x74]);
    expect(parse(pngWithCaBX(body))).toBe('test');
  });

  it('returns empty when the value after the key is not a CBOR text string', () => {
    // 0x00 is an integer, not a text string (major type 3 = 0x60-0x7b).
    expect(parse(pngWithCaBX(manifest([0x00])))).toBe('');
  });

  it('returns empty for unsupported 4-byte length encoding (additional > 25)', () => {
    // 0x7a selects a 4-byte length, which the minimal reader rejects.
    expect(parse(pngWithCaBX(manifest([0x7a, 0, 0, 0, 1, 0x41])))).toBe('');
  });

  it('returns empty when the declared length runs past the chunk end', () => {
    // 0x6a = text string of length 10, but only 2 bytes follow.
    expect(parse(pngWithCaBX(manifest([0x6a, 0x41, 0x42])))).toBe('');
  });

  it('returns empty when the chunk length exceeds the data length', () => {
    // Declare a 100-byte caBX chunk but provide no body.
    const png = new Uint8Array([
      ...SIGNATURE,
      0,
      0,
      0,
      100,
      0x63,
      0x61,
      0x42,
      0x58,
    ]);
    expect(parse(png)).toBe('');
  });

  it('terminates on a zero-length chunk without scanning forever', () => {
    // A zero-length non-caBX chunk must still advance the walker (offset += 12).
    const png = new Uint8Array([
      ...SIGNATURE,
      0,
      0,
      0,
      0,
      0x49,
      0x48,
      0x44,
      0x52, // "IHDR"
      0,
      0,
      0,
      0, // CRC
    ]);
    expect(parse(png)).toBe('');
  });
});
