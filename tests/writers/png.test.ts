import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPngMetadata } from '../../src/readers/png';
import { writePngMetadata } from '../../src/writers/png';

const SAMPLES_DIR = join(__dirname, '../../samples/png');

/**
 * Load sample PNG file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

/**
 * Get all PNG sample filenames
 */
function getAllSampleFilenames(): string[] {
  return readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.png'));
}

describe('writePngMetadata', () => {
  describe('error handling', () => {
    it('should return error for invalid signature', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      const result = writePngMetadata(data, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });

    it('should return error for empty data', () => {
      const data = new Uint8Array([]);
      const result = writePngMetadata(data, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('tEXt chunk writing', () => {
    it('should write and read back tEXt chunks', () => {
      const sampleData = loadSample('novelai-full.png');
      const originalRead = readPngMetadata(sampleData);
      expect(originalRead.ok).toBe(true);
      if (!originalRead.ok) return;

      // Filter only tEXt chunks
      const textChunks = originalRead.value.chunks.filter(
        (c) => c.type === 'tEXt',
      );

      // Write chunks
      const writeResult = writePngMetadata(sampleData, textChunks);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read back
      const readBack = readPngMetadata(writeResult.value);
      expect(readBack.ok).toBe(true);
      if (!readBack.ok) return;

      // Verify chunks match
      expect(readBack.value.chunks.length).toBe(textChunks.length);
      for (let i = 0; i < textChunks.length; i++) {
        expect(readBack.value.chunks[i]).toEqual(textChunks[i]);
      }
    });
  });

  describe('iTXt chunk writing', () => {
    it('should write and read back iTXt chunks', () => {
      const sampleData = loadSample('invokeai.png');
      const originalRead = readPngMetadata(sampleData);
      expect(originalRead.ok).toBe(true);
      if (!originalRead.ok) return;

      // Filter only iTXt chunks
      const itxtChunks = originalRead.value.chunks.filter(
        (c) => c.type === 'iTXt',
      );

      // Write chunks
      const writeResult = writePngMetadata(sampleData, itxtChunks);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read back
      const readBack = readPngMetadata(writeResult.value);
      expect(readBack.ok).toBe(true);
      if (!readBack.ok) return;

      // Verify chunks match
      expect(readBack.value.chunks.length).toBe(itxtChunks.length);
      for (let i = 0; i < itxtChunks.length; i++) {
        expect(readBack.value.chunks[i]).toEqual(itxtChunks[i]);
      }
    });
  });

  describe('round-trip tests', () => {
    const sampleFiles = getAllSampleFilenames();

    it.each(sampleFiles)('should round-trip %s', (filename) => {
      const sampleData = loadSample(filename);

      // Read original metadata
      const originalRead = readPngMetadata(sampleData);
      expect(originalRead.ok).toBe(true);
      if (!originalRead.ok) return;

      // Write metadata back
      const writeResult = writePngMetadata(
        sampleData,
        originalRead.value.chunks,
      );
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read from new image
      const readBack = readPngMetadata(writeResult.value);
      expect(readBack.ok).toBe(true);
      if (!readBack.ok) return;

      // Verify all chunks match exactly
      expect(readBack.value.chunks.length).toBe(
        originalRead.value.chunks.length,
      );
      for (let i = 0; i < originalRead.value.chunks.length; i++) {
        expect(readBack.value.chunks[i]).toEqual(originalRead.value.chunks[i]);
      }

      // Verify software detection still works
      expect(readBack.value.software).toBe(originalRead.value.software);
    });
  });

  describe('empty chunks', () => {
    it('should handle empty chunk list', () => {
      const sampleData = loadSample('novelai-full.png');

      const writeResult = writePngMetadata(sampleData, []);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readBack = readPngMetadata(writeResult.value);
      expect(readBack.ok).toBe(true);
      if (!readBack.ok) return;

      expect(readBack.value.chunks.length).toBe(0);
      expect(readBack.value.software).toBe(null);
    });
  });
});
