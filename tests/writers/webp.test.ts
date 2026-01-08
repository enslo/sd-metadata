import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWebpMetadata } from '../../src/readers/webp';
import { writeWebpMetadata } from '../../src/writers/webp';

const SAMPLES_DIR = join(__dirname, '../../samples/webp');

/**
 * Load sample WebP file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

describe('writeWebpMetadata', () => {
  describe('signature validation', () => {
    it('should return error for invalid WebP signature', () => {
      const data = new Uint8Array([
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
      const result = writeWebpMetadata(data, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('round-trip tests', () => {
    it('should preserve metadata through read-write-read cycle (forge-neo.webp)', () => {
      const original = loadSample('forge-neo.webp');

      // Read original metadata
      const readResult1 = readWebpMetadata(original);
      expect(readResult1.ok).toBe(true);
      if (!readResult1.ok) return;

      // Write metadata to new file
      const writeResult = writeWebpMetadata(
        original,
        readResult1.value.segments,
      );
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read back written metadata
      const readResult2 = readWebpMetadata(writeResult.value);
      expect(readResult2.ok).toBe(true);
      if (!readResult2.ok) return;

      // Verify metadata exists
      expect(readResult2.value.segments.length).toBeGreaterThan(0);
    });

    it('should preserve metadata through read-write-read cycle (swarmui.webp)', () => {
      const original = loadSample('swarmui.webp');

      const readResult1 = readWebpMetadata(original);
      expect(readResult1.ok).toBe(true);
      if (!readResult1.ok) return;

      const writeResult = writeWebpMetadata(
        original,
        readResult1.value.segments,
      );
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult2 = readWebpMetadata(writeResult.value);
      expect(readResult2.ok).toBe(true);
      if (!readResult2.ok) return;

      expect(readResult2.value.segments.length).toBeGreaterThan(0);
    });

    it('should write custom metadata', () => {
      const original = loadSample('forge-neo.webp');

      const testSegments = [
        {
          source: { type: 'exifUserComment' as const },
          data: '{"custom": "metadata"}',
        },
      ];

      const writeResult = writeWebpMetadata(original, testSegments);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = readWebpMetadata(writeResult.value);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      expect(readResult.value.segments.length).toBeGreaterThan(0);
      expect(readResult.value.segments[0].data).toBe('{"custom": "metadata"}');
    });
  });
});
