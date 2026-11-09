import { describe, expect, it } from 'vitest';
import { readWebpMetadata } from '../../../src/readers/webp';
import type { MetadataSegment } from '../../../src/types';
import { writeWebpMetadata } from '../../../src/writers/webp';
import { createMinimalWebp } from '../../helpers/minimal-images';

describe('writeWebpMetadata - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for invalid WebP', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const segments: MetadataSegment[] = [];
      const result = writeWebpMetadata(data, segments);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('segment writing', () => {
    it('should write Exif UserComment segment', () => {
      const webp = createMinimalWebp();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'Test comment',
        },
      ];

      const result = writeWebpMetadata(webp, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify we can read it back
        const readResult = readWebpMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          expect(readResult.value.at(0)).toMatchObject({
            source: { type: 'exifUserComment' },
            data: 'Test comment',
          });
        }
      }
    });

    it('should write multiple Exif segments', () => {
      const webp = createMinimalWebp();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'User comment',
        },
        {
          source: { type: 'exifImageDescription' },
          data: 'Image desc',
        },
      ];

      const result = writeWebpMetadata(webp, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readWebpMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.length).toBeGreaterThanOrEqual(1);
          // Verify UserComment exists (Exif segments are combined in one EXIF chunk)
          const userComment = readResult.value.find(
            (s) => s.source.type === 'exifUserComment',
          );
          expect(userComment).toBeDefined();
        }
      }
    });

    it('should write empty segments array (strip metadata)', () => {
      const webp = createMinimalWebp();

      // First, add metadata
      const segmentsToAdd: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: 'Data to remove' },
      ];
      const resultWithMetadata = writeWebpMetadata(webp, segmentsToAdd);
      expect(resultWithMetadata.ok).toBe(true);
      if (!resultWithMetadata.ok) return;

      // Verify metadata was added
      const readBeforeStrip = readWebpMetadata(resultWithMetadata.value);
      expect(readBeforeStrip.ok).toBe(true);
      if (readBeforeStrip.ok) {
        expect(readBeforeStrip.value).toHaveLength(1);
      }

      // Now strip metadata with empty array
      const emptySegments: MetadataSegment[] = [];
      const resultStripped = writeWebpMetadata(
        resultWithMetadata.value,
        emptySegments,
      );

      expect(resultStripped.ok).toBe(true);
      if (resultStripped.ok) {
        const readResult = readWebpMetadata(resultStripped.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(0);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle special characters', () => {
      const webp = createMinimalWebp();
      const specialData = 'Hello\\nWorld\\t"quotes"';
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: specialData,
        },
      ];

      const result = writeWebpMetadata(webp, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readWebpMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.at(0)?.data).toBe(specialData);
        }
      }
    });

    // Note: Current Exif UserComment implementation uses basic charCodeAt()
    // for UTF-16LE encoding, which doesn't properly handle multibyte characters
    // or surrogate pairs. Unicode tests are deferred to Sample Tests with
    // real-world files.
  });

  describe('round-trip preservation', () => {
    it('should preserve Exif metadata', () => {
      const webp = createMinimalWebp();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'User comment data',
        },
        {
          source: { type: 'exifImageDescription' },
          data: 'Image description',
        },
      ];

      const result = writeWebpMetadata(webp, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readWebpMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          // WebP combines all Exif fields in one EXIF chunk
          expect(readResult.value.length).toBeGreaterThanOrEqual(1);

          // Verify specific segments exist
          const userComment = readResult.value.find(
            (s) => s.source.type === 'exifUserComment',
          );

          expect(userComment).toBeDefined();
          expect(userComment?.data).toBe('User comment data');
        }
      }
    });
  });

  describe('RIFF structure', () => {
    it('should produce valid RIFF structure', () => {
      const webp = createMinimalWebp();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'Test',
        },
      ];

      const result = writeWebpMetadata(webp, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const output = result.value;

        // Verify RIFF signature
        expect(output[0]).toBe(0x52); // R
        expect(output[1]).toBe(0x49); // I
        expect(output[2]).toBe(0x46); // F
        expect(output[3]).toBe(0x46); // F

        // Verify WEBP marker
        expect(output[8]).toBe(0x57); // W
        expect(output[9]).toBe(0x45); // E
        expect(output[10]).toBe(0x42); // B
        expect(output[11]).toBe(0x50); // P
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Extended format (VP8X) handling
// ---------------------------------------------------------------------------

/** RIFF container around the given chunks */
function riff(...chunks: Uint8Array[]): Uint8Array {
  const body = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(12 + body);
  out.set(new TextEncoder().encode('RIFF'), 0);
  new DataView(out.buffer).setUint32(4, 4 + body, true);
  out.set(new TextEncoder().encode('WEBP'), 8);
  let offset = 12;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Chunk with the given FourCC and payload, padded to an even length */
function chunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length + (payload.length % 2));
  out.set(new TextEncoder().encode(type), 0);
  new DataView(out.buffer).setUint32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

/** VP8L chunk holding only the bitstream header of a width × height image */
function vp8l(width: number, height: number, alpha: boolean): Uint8Array {
  const bits = (width - 1) | ((height - 1) << 14) | (alpha ? 1 << 28 : 0);
  const payload = new Uint8Array(5);
  payload[0] = 0x2f;
  new DataView(payload.buffer).setUint32(1, bits >>> 0, true);
  return chunk('VP8L', payload);
}

/** VP8X chunk with the given flags and canvas size */
function vp8x(flags: number, width: number, height: number): Uint8Array {
  const payload = new Uint8Array(10);
  payload[0] = flags;
  for (let i = 0; i < 3; i++) {
    payload[4 + i] = ((width - 1) >> (8 * i)) & 0xff;
    payload[7 + i] = ((height - 1) >> (8 * i)) & 0xff;
  }
  return chunk('VP8X', payload);
}

/** Chunk FourCCs in file order */
function chunkTypes(webp: Uint8Array): string[] {
  const dv = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  const types: string[] = [];
  let offset = 12;
  while (offset + 8 <= webp.length) {
    types.push(String.fromCharCode(...webp.subarray(offset, offset + 4)));
    const size = dv.getUint32(offset + 4, true);
    offset += 8 + size + (size % 2);
  }
  return types;
}

/** Flags and canvas size of the VP8X chunk at the start of the file */
function vp8xHeader(webp: Uint8Array): {
  flags: number;
  width: number;
  height: number;
} {
  const u24 = (o: number) =>
    (webp[o] ?? 0) | ((webp[o + 1] ?? 0) << 8) | ((webp[o + 2] ?? 0) << 16);
  return { flags: webp[20] ?? 0, width: u24(24) + 1, height: u24(27) + 1 };
}

const USER_COMMENT: MetadataSegment[] = [
  { source: { type: 'exifUserComment' }, data: 'Test comment' },
];

describe('writeWebpMetadata - extended format', () => {
  it('should promote a simple VP8L file to the extended format with the EXIF flag set', () => {
    const result = writeWebpMetadata(riff(vp8l(300, 200, false)), USER_COMMENT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(chunkTypes(result.value)).toEqual(['VP8X', 'VP8L', 'EXIF']);
      expect(vp8xHeader(result.value)).toEqual({
        flags: 0x08,
        width: 300,
        height: 200,
      });
      const readResult = readWebpMetadata(result.value);
      expect(readResult.ok && readResult.value.at(0)?.data).toBe(
        'Test comment',
      );
    }
  });

  it('should carry the alpha bit of a VP8L bitstream into the VP8X header', () => {
    const result = writeWebpMetadata(riff(vp8l(16, 16, true)), USER_COMMENT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(vp8xHeader(result.value).flags).toBe(0x18);
    }
  });

  it('should set the EXIF flag on an existing VP8X header and keep its other flags', () => {
    const input = riff(vp8x(0x10, 16, 16), vp8l(16, 16, true));

    const result = writeWebpMetadata(input, USER_COMMENT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(chunkTypes(result.value)).toEqual(['VP8X', 'VP8L', 'EXIF']);
      expect(vp8xHeader(result.value)).toEqual({
        flags: 0x18,
        width: 16,
        height: 16,
      });
    }
  });

  it('should clear the EXIF and XMP flags when stripping metadata', () => {
    const input = riff(
      vp8x(0x1c, 16, 16),
      vp8l(16, 16, true),
      chunk('EXIF', new Uint8Array([1, 2, 3])),
    );

    const result = writeWebpMetadata(input, []);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(chunkTypes(result.value)).toEqual(['VP8X', 'VP8L']);
      expect(vp8xHeader(result.value).flags).toBe(0x10);
    }
  });

  it('should leave a simple file in the simple format when no metadata is written', () => {
    const result = writeWebpMetadata(riff(vp8l(16, 16, false)), []);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(chunkTypes(result.value)).toEqual(['VP8L']);
    }
  });

  it('should append metadata without a header when the image header cannot be read', () => {
    // The minimal test image has a placeholder VP8 payload with no size
    const result = writeWebpMetadata(createMinimalWebp(), USER_COMMENT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(chunkTypes(result.value)).toEqual(['VP8 ', 'EXIF']);
    }
  });
});
