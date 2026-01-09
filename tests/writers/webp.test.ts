import { readFileSync, readdirSync } from 'node:fs';
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

/**
 * Get all WebP sample filenames
 */
function getAllSampleFilenames(): string[] {
  return readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.webp'));
}

describe('writeWebpMetadata', () => {
  describe('error handling', () => {
    it('should return error for invalid signature', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = writeWebpMetadata(data, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });

    it('should return error for empty data', () => {
      const data = new Uint8Array([]);
      const result = writeWebpMetadata(data, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('round-trip tests', () => {
    const sampleFiles = getAllSampleFilenames();

    it.each(sampleFiles)('should round-trip %s', (filename) => {
      const sampleData = loadSample(filename);

      // Read original metadata
      const originalRead = readWebpMetadata(sampleData);
      expect(originalRead.ok).toBe(true);
      if (!originalRead.ok) return;

      // Write metadata back
      const writeResult = writeWebpMetadata(sampleData, originalRead.value);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read from new image
      const readBack = readWebpMetadata(writeResult.value);
      expect(readBack.ok).toBe(true);
      if (!readBack.ok) return;

      // Verify all segments match exactly
      expect(readBack.value.length).toBe(originalRead.value.length);
      for (let i = 0; i < originalRead.value.length; i++) {
        expect(readBack.value[i]).toEqual(originalRead.value[i]);
      }
    });
  });

  describe('empty segments', () => {
    it('should handle empty segment list', () => {
      const sampleData = loadSample('novelai-curated.webp');

      const writeResult = writeWebpMetadata(sampleData, []);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readBack = readWebpMetadata(writeResult.value);
      // Should have no metadata (or error if no metadata found)
      if (readBack.ok) {
        expect(readBack.value.length).toBe(0);
      } else {
        expect(readBack.error.type).toBe('noExifChunk');
      }
    });
  });
});
