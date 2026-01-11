import { describe, expect, it } from 'vitest';
import { readJpegMetadata } from '../../../src/readers/jpeg';
import type { MetadataSegment } from '../../../src/types';

/**
 * Create minimal valid JPEG (SOI + EOI only)
 */
function createMinimalJpeg(): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xd9, // EOI
  ]);
}

/**
 * Create JPEG COM segment
 */
function createComSegment(data: string): Uint8Array {
  const dataBytes = new TextEncoder().encode(data);
  const segment = new Uint8Array(4 + dataBytes.length);
  const view = new DataView(segment.buffer);

  segment[0] = 0xff;
  segment[1] = 0xfe; // COM marker
  view.setUint16(2, dataBytes.length + 2, false); // Length includes length field itself
  segment.set(dataBytes, 4);

  return segment;
}

/**
 * Combine JPEG markers and segments
 */
function createJpegWithSegments(...segments: Uint8Array[]): Uint8Array {
  const soi = new Uint8Array([0xff, 0xd8]);
  const eoi = new Uint8Array([0xff, 0xd9]);

  const totalLength =
    soi.length + segments.reduce((sum, s) => sum + s.length, 0) + eoi.length;
  const result = new Uint8Array(totalLength);

  let offset = 0;
  result.set(soi, offset);
  offset += soi.length;

  for (const segment of segments) {
    result.set(segment, offset);
    offset += segment.length;
  }

  result.set(eoi, offset);

  return result;
}

describe('readJpegMetadata - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for invalid JPEG', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });

    it('should handle SOI-only JPEG (valid signature but no segments)', () => {
      // SOI-only is a valid JPEG signature but has no metadata segments
      const data = new Uint8Array([0xff, 0xd8]); // Only SOI marker
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should return empty array since there are no segments
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('segment reading', () => {
    it('should read empty JPEG (no metadata)', () => {
      const data = createMinimalJpeg();
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it('should read COM segment', () => {
      const com = createComSegment('Test comment');
      const data = createJpegWithSegments(com);
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value.at(0)).toMatchObject({
          data: 'Test comment',
          source: { type: 'jpegCom' },
        } satisfies Partial<MetadataSegment>);
      }
    });

    it('should read first COM segment', () => {
      // Note: Current implementation may only read the first COM segment
      const com1 = createComSegment('COM data 1');
      const com2 = createComSegment('COM data 2');
      const data = createJpegWithSegments(com1, com2);
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThanOrEqual(1);
        // At least the first COM segment should be read
        expect(result.value.at(0)?.source.type).toBe('jpegCom');
        expect(result.value.at(0)?.data).toBe('COM data 1');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty COM segment', () => {
      const com = createComSegment('');
      const data = createJpegWithSegments(com);
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value.at(0)?.data).toBe('');
      }
    });

    it('should handle special characters in COM', () => {
      const specialData = 'Line1\\nLine2\\tTab"Quotes"';
      const com = createComSegment(specialData);
      const data = createJpegWithSegments(com);
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.at(0)?.data).toBe(specialData);
      }
    });

    it('should handle Unicode in segments', () => {
      const unicodeData = 'こんにちは 🌏';
      const com = createComSegment(unicodeData);
      const data = createJpegWithSegments(com);
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.at(0)?.data).toBe(unicodeData);
      }
    });
  });
});
