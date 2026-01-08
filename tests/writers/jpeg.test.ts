import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJpegMetadata } from '../../src/readers/jpeg';
import { writeJpegMetadata } from '../../src/writers/jpeg';

const SAMPLES_DIR = join(__dirname, '../../samples/jpg');

/**
 * Load sample JPEG file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

describe('writeJpegMetadata', () => {
  describe('signature validation', () => {
    it('should return error for invalid JPEG signature', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const result = writeJpegMetadata(data, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('round-trip tests', () => {
    it('should preserve metadata through read-write-read cycle (civitai.jpeg)', () => {
      const original = loadSample('civitai.jpeg');

      // Read original metadata
      const readResult1 = readJpegMetadata(original);
      expect(readResult1.ok).toBe(true);
      if (!readResult1.ok) return;

      // Write metadata to new file
      const writeResult = writeJpegMetadata(
        original,
        readResult1.value.segments,
      );
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read back written metadata
      const readResult2 = readJpegMetadata(writeResult.value);
      expect(readResult2.ok).toBe(true);
      if (!readResult2.ok) return;

      // Verify metadata matches
      expect(readResult2.value.segments.length).toBeGreaterThan(0);
      expect(readResult2.value.segments[0].data).toContain('Steps:');
    });

    it('should preserve metadata through read-write-read cycle (forge-neo.jpeg)', () => {
      const original = loadSample('forge-neo.jpeg');

      const readResult1 = readJpegMetadata(original);
      expect(readResult1.ok).toBe(true);
      if (!readResult1.ok) return;

      const writeResult = writeJpegMetadata(
        original,
        readResult1.value.segments,
      );
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult2 = readJpegMetadata(writeResult.value);
      expect(readResult2.ok).toBe(true);
      if (!readResult2.ok) return;

      expect(readResult2.value.segments.length).toBeGreaterThan(0);
    });

    it('should write COM segment for jpegCom source', () => {
      const original = loadSample('civitai.jpeg');

      const testSegments = [
        { source: { type: 'jpegCom' as const }, data: 'Test COM data' },
      ];

      const writeResult = writeJpegMetadata(original, testSegments);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = readJpegMetadata(writeResult.value);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      const comSegment = readResult.value.segments.find(
        (s) => s.source.type === 'jpegCom',
      );
      expect(comSegment).toBeDefined();
      expect(comSegment?.data).toBe('Test COM data');
    });

    it('should write exifUserComment segment', () => {
      const original = loadSample('civitai.jpeg');

      const testSegments = [
        {
          source: { type: 'exifUserComment' as const },
          data: '{"test": "data"}',
        },
      ];

      const writeResult = writeJpegMetadata(original, testSegments);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = readJpegMetadata(writeResult.value);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      const userCommentSegment = readResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userCommentSegment).toBeDefined();
      expect(userCommentSegment?.data).toBe('{"test": "data"}');
    });
  });
});
