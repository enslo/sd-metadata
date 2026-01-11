import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJpegMetadata } from '../../../src/readers/jpeg';
import { writeJpegMetadata } from '../../../src/writers/jpeg';

const SAMPLES_DIR = join(__dirname, '../../../samples/jpg');

/**
 * Load sample JPEG file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

/**
 * Get all JPEG sample filenames
 */
function getAllSampleFilenames(): string[] {
  return readdirSync(SAMPLES_DIR).filter(
    (f) => f.endsWith('.jpg') || f.endsWith('.jpeg'),
  );
}

describe('writeJpegMetadata', () => {
  describe('error handling', () => {
    it('should return error for invalid signature', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      const result = writeJpegMetadata(data, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });

    it('should return error for empty data', () => {
      const data = new Uint8Array([]);
      const result = writeJpegMetadata(data, []);

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
      const originalRead = readJpegMetadata(sampleData);
      expect(originalRead.ok).toBe(true);
      if (!originalRead.ok) return;

      // Write metadata back
      const writeResult = writeJpegMetadata(sampleData, originalRead.value);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read from new image
      const readBack = readJpegMetadata(writeResult.value);
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
      const sampleData = loadSample('civitai.jpeg');

      const writeResult = writeJpegMetadata(sampleData, []);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readBack = readJpegMetadata(writeResult.value);
      // Should have no metadata (or error if no metadata found)
      if (readBack.ok) {
        expect(readBack.value.length).toBe(0);
      } else {
        expect(readBack.error.type).toBe('noMetadata');
      }
    });
  });
});
