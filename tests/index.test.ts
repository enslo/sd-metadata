import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, write } from '../src/index';

const SAMPLE_DIR = join(__dirname, '../samples');

// Helper to read sample
const readSample = (filename: string) =>
  readFileSync(join(SAMPLE_DIR, filename));

describe('Unified API', () => {
  describe('read()', () => {
    it('should read PNG metadata', () => {
      const data = readSample('png/forge-neo.png');
      const result = read(data);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.raw.format).toBe('png');
        expect(result.metadata.software).toBe('forge-neo');
        expect(result.metadata.width).toBeGreaterThan(0);
      }
    });

    it('should read JPEG metadata', () => {
      const data = readSample('jpg/forge-neo.jpeg');
      const result = read(data);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.raw.format).toBe('jpeg');
      }
    });

    it('should read WebP metadata', () => {
      const data = readSample('webp/forge-neo.webp');
      const result = read(data);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.raw.format).toBe('webp');
      }
    });

    it('should return error for invalid format', () => {
      const data = new Uint8Array([0, 0, 0, 0]);
      const result = read(data);
      expect(result.status).toBe('invalid');
      if (result.status === 'invalid') {
        expect(result.message).toContain('Unknown image format');
      }
    });
  });

  describe('write()', () => {
    it('should round-trip PNG metadata', () => {
      const data = readSample('png/forge-neo.png');
      const readResult = read(data);
      expect(readResult.status).toBe('success');

      if (readResult.status === 'success') {
        const writeResult = write(data, readResult);
        expect(writeResult.ok).toBe(true);
        if (writeResult.ok) {
          const reRead = read(writeResult.value);
          expect(reRead.status).toBe('success');
          expect(reRead.status === 'success' && reRead.metadata.software).toBe(
            'forge-neo',
          );
        }
      }
    });

    it('should convert PNG metadata to JPEG', () => {
      const pngData = readSample('png/forge-neo.png');
      const jpegData = readSample('jpg/forge-neo.jpeg'); // Use valid jpeg container

      const pngResult = read(pngData);
      expect(pngResult.status).toBe('success');

      if (pngResult.status === 'success') {
        const writeResult = write(jpegData, pngResult);
        expect(writeResult.ok).toBe(true);

        if (writeResult.ok) {
          const reRead = read(writeResult.value);
          expect(reRead.status).toBe('success');
          if (reRead.status === 'success') {
            expect(reRead.raw.format).toBe('jpeg');
            // forge-neo metadata should be preserved/converted
            expect(reRead.metadata.prompt).toBe(pngResult.metadata.prompt);
          }
        }
      }
    });
  });
});
