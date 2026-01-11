import { describe, expect, it } from 'vitest';
import { readWebpMetadata } from '../../../src/readers/webp';
import type { MetadataSegment } from '../../../src/types';
import { writeWebpMetadata } from '../../../src/writers/webp';

/**
 * Create a minimal valid WebP structure for testing
 */
function createMinimalWebp(): Uint8Array {
  return new Uint8Array([
    // RIFF header
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x14,
    0x00,
    0x00,
    0x00, // File size - 8
    0x57,
    0x45,
    0x42,
    0x50, // "WEBP"
    // VP8 chunk (minimal)
    0x56,
    0x50,
    0x38,
    0x20, // "VP8 "
    0x08,
    0x00,
    0x00,
    0x00, // Chunk size
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // Placeholder data
  ]);
}

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
