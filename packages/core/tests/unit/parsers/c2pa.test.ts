import { describe, expect, it } from 'vitest';
import { detectC2pa } from '../../../src/parsers/c2pa';

const DST_PREFIX = 'http://cv.iptc.org/newscodes/digitalsourcetype/';

/**
 * Encode a CBOR text string (major type 3) with a 1-byte length header,
 * the encoding real manifests use for DigitalSourceType URIs.
 */
function cborText(value: string): number[] {
  const bytes = [...new TextEncoder().encode(value)];
  return [0x78, bytes.length, ...bytes];
}

/**
 * Encode a short CBOR text string (inline length, under 24 bytes).
 * The header byte 0x60 + length lands in the ASCII letter range.
 */
function cborShortText(value: string): number[] {
  const bytes = [...new TextEncoder().encode(value)];
  return [0x60 + bytes.length, ...bytes];
}

/**
 * Wrap manifest bytes in a minimal PNG whose only chunk is `caBX`.
 * CRCs are placeholders: detection does not verify them.
 */
function createPngWithCaBX(manifest: number[]): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const length = manifest.length;
  const caBX = [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    0x63, // 'c'
    0x61, // 'a'
    0x42, // 'B'
    0x58, // 'X'
    ...manifest,
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  const iend = [
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ];
  return new Uint8Array([...signature, ...caBX, ...iend]);
}

describe('detectC2pa - DigitalSourceType', () => {
  it('stops at the CBOR string length when the next map key starts with a letter', () => {
    // Shape of a Sora manifest: the DST value is immediately followed by the
    // key "allActionsIncluded", whose header byte 0x72 reads as 'r'.
    const png = createPngWithCaBX([
      ...cborShortText('digitalSourceType'),
      ...cborText(`${DST_PREFIX}trainedAlgorithmicMedia`),
      ...cborShortText('allActionsIncluded'),
      0xf5, // true
    ]);

    expect(detectC2pa(png, 'png')).toEqual({
      vendor: 'unknown',
      aiGenerated: true,
      digitalSourceType: `${DST_PREFIX}trainedAlgorithmicMedia`,
    });
  });

  it('keeps a non-AI source type bounded and unflagged', () => {
    const png = createPngWithCaBX([
      ...cborShortText('digitalSourceType'),
      ...cborText(`${DST_PREFIX}digitalCapture`),
      ...cborShortText('when'),
    ]);

    expect(detectC2pa(png, 'png')).toEqual({
      vendor: 'unknown',
      aiGenerated: false,
      digitalSourceType: `${DST_PREFIX}digitalCapture`,
    });
  });

  it('ignores a header-like byte pair that would cut into the URI', () => {
    // 0x78 0x05 looks like a 1-byte CBOR header, but a 5-byte string cannot
    // hold the URI, so it is not the URI's own header.
    const uri = `${DST_PREFIX}trainedAlgorithmicMedia`;
    const png = createPngWithCaBX([
      0x78,
      0x05,
      ...new TextEncoder().encode(uri),
      0x3c, // '<'
    ]);

    expect(detectC2pa(png, 'png')).toEqual({
      vendor: 'unknown',
      aiGenerated: true,
      digitalSourceType: uri,
    });
  });

  it('still reads a URI that is not CBOR-encoded (e.g. embedded XMP)', () => {
    const xmp = `<Iptc4xmpExt:DigitalSourceType>${DST_PREFIX}trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>`;
    const png = createPngWithCaBX([...new TextEncoder().encode(xmp)]);

    expect(detectC2pa(png, 'png')).toEqual({
      vendor: 'unknown',
      aiGenerated: true,
      digitalSourceType: `${DST_PREFIX}trainedAlgorithmicMedia`,
    });
  });
});
