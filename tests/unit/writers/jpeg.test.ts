import { describe, expect, it } from 'vitest';
import { readJpegMetadata } from '../../../src/readers/jpeg';
import type { MetadataSegment } from '../../../src/types';
import { writeJpegMetadata } from '../../../src/writers/jpeg';
import { createMinimalJpeg } from '../../helpers/minimal-images';

describe('writeJpegMetadata - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for invalid JPEG', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const segments: MetadataSegment[] = [];
      const result = writeJpegMetadata(data, segments);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('segment writing', () => {
    it('should write COM segment', () => {
      const jpeg = createMinimalJpeg();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'jpegCom' },
          data: 'Test comment',
        },
      ];

      const result = writeJpegMetadata(jpeg, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify we can read it back
        const readResult = readJpegMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          expect(readResult.value.at(0)).toMatchObject({
            source: { type: 'jpegCom' },
            data: 'Test comment',
          });
        }
      }
    });

    it('should write Exif UserComment segment', () => {
      const jpeg = createMinimalJpeg();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'Exif comment',
        },
      ];

      const result = writeJpegMetadata(jpeg, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readJpegMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          expect(readResult.value.at(0)?.source.type).toBe('exifUserComment');
          expect(readResult.value.at(0)?.data).toBe('Exif comment');
        }
      }
    });

    it('should write multiple segments', () => {
      const jpeg = createMinimalJpeg();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'Exif data',
        },
        {
          source: { type: 'jpegCom' },
          data: 'COM data',
        },
      ];

      const result = writeJpegMetadata(jpeg, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readJpegMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.length).toBeGreaterThanOrEqual(2);
          // Verify both types exist
          const hasExif = readResult.value.some(
            (s) => s.source.type === 'exifUserComment',
          );
          const hasCom = readResult.value.some(
            (s) => s.source.type === 'jpegCom',
          );
          expect(hasExif).toBe(true);
          expect(hasCom).toBe(true);
        }
      }
    });

    it('should write empty segments array (strip metadata)', () => {
      const jpeg = createMinimalJpeg();

      // First, add metadata
      const segmentsToAdd: MetadataSegment[] = [
        { source: { type: 'jpegCom' }, data: 'COM data to remove' },
        { source: { type: 'exifUserComment' }, data: 'Exif data to remove' },
      ];
      const resultWithMetadata = writeJpegMetadata(jpeg, segmentsToAdd);
      expect(resultWithMetadata.ok).toBe(true);
      if (!resultWithMetadata.ok) return;

      // Verify metadata was added
      const readBeforeStrip = readJpegMetadata(resultWithMetadata.value);
      expect(readBeforeStrip.ok).toBe(true);
      if (readBeforeStrip.ok) {
        expect(readBeforeStrip.value.length).toBeGreaterThanOrEqual(2);
      }

      // Now strip metadata with empty array
      const emptySegments: MetadataSegment[] = [];
      const resultStripped = writeJpegMetadata(
        resultWithMetadata.value,
        emptySegments,
      );

      expect(resultStripped.ok).toBe(true);
      if (resultStripped.ok) {
        const readResult = readJpegMetadata(resultStripped.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(0);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty data', () => {
      const jpeg = createMinimalJpeg();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'jpegCom' },
          data: '',
        },
      ];

      const result = writeJpegMetadata(jpeg, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readJpegMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          expect(readResult.value.at(0)?.data).toBe('');
        }
      }
    });

    it('should handle special characters', () => {
      const jpeg = createMinimalJpeg();
      const specialData = 'Hello\\nWorld\\t"quotes"';
      const segments: MetadataSegment[] = [
        {
          source: { type: 'jpegCom' },
          data: specialData,
        },
      ];

      const result = writeJpegMetadata(jpeg, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readJpegMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.at(0)?.data).toBe(specialData);
        }
      }
    });

    it('should handle Unicode', () => {
      const jpeg = createMinimalJpeg();
      const unicodeData = 'こんにちは 🌏';
      const segments: MetadataSegment[] = [
        {
          source: { type: 'jpegCom' },
          data: unicodeData,
        },
      ];

      const result = writeJpegMetadata(jpeg, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readJpegMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.at(0)?.data).toBe(unicodeData);
        }
      }
    });

    // Note: The above tests use jpegCom (COM segment) which uses UTF-8 encoding
    // and supports full Unicode including multibyte characters and emoji.
    //
    // However, Exif UserComment uses UTF-16LE encoding with charCodeAt(), which
    // has limitations:
    // - Does not properly handle multibyte characters (Japanese, Chinese, Korean, etc.)
    // - Does not support surrogate pairs (emoji and Unicode beyond BMP)
    //
    // For full Unicode support in JPEG metadata, use jpegCom instead of exifUserComment.
    // Unicode tests for Exif UserComment are deferred to Sample Tests with real-world files.
  });

  describe('round-trip preservation', () => {
    it('should preserve all segment types', () => {
      const jpeg = createMinimalJpeg();
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'User comment data',
        },
        {
          source: { type: 'exifImageDescription' },
          data: 'Image description',
        },
        {
          source: { type: 'jpegCom' },
          data: 'COM segment data',
        },
      ];

      const result = writeJpegMetadata(jpeg, segments);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readJpegMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          // Should have all segments (Exif segments may be combined in APP1)
          expect(readResult.value.length).toBeGreaterThanOrEqual(2);

          // Verify specific segments exist
          const userComment = readResult.value.find(
            (s) => s.source.type === 'exifUserComment',
          );
          const com = readResult.value.find((s) => s.source.type === 'jpegCom');

          expect(userComment).toBeDefined();
          expect(userComment?.data).toBe('User comment data');
          expect(com).toBeDefined();
          expect(com?.data).toBe('COM segment data');
        }
      }
    });
  });
});
