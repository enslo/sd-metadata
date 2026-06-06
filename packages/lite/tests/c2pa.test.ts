import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../src/index';
import { readPng } from '../src/read';

const SAMPLES = join(import.meta.dirname, '../../../samples');

function load(file: string): Uint8Array {
  return new Uint8Array(readFileSync(join(SAMPLES, 'c2pa/png', file)));
}

function loadPng(file: string): Uint8Array {
  return new Uint8Array(readFileSync(join(SAMPLES, 'png', file)));
}

describe('C2PA Content Credentials detection', () => {
  // For images with no A1111 parameters, parse() returns the C2PA generator
  // name — the only human-readable provenance signal these exports carry.
  it('returns the OpenAI generator name for a ChatGPT image', () => {
    expect(parse(load('chatgpt-image2.png'))).toBe('OpenAI Media Service API');
  });

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

describe('C2PA detection - malformed input safety', () => {
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

  // Encode "claim_generator_info" + the "name" CBOR key ("dname") prefix so the
  // tests exercise the value-decoding path directly.
  function manifest(valueBytes: number[]): number[] {
    const marker = [...'claim_generator_info'].map((c) => c.charCodeAt(0));
    const key = [...'dname'].map((c) => c.charCodeAt(0));
    return [...marker, ...key, ...valueBytes];
  }

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
