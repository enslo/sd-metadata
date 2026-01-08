import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findExifChunk,
  isValidWebpSignature,
  readWebpMetadata,
} from '../../src/readers/webp';

const SAMPLES_DIR = join(__dirname, '../../samples/webp');

/**
 * Load sample WebP file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

/**
 * Helper to get first segment data from result
 */
function getFirstSegmentData(
  result: ReturnType<typeof readWebpMetadata>,
): string | null {
  if (!result.ok) return null;
  return result.value.segments[0]?.data ?? null;
}

describe('readWebpMetadata', () => {
  describe('signature validation', () => {
    it('should return true for valid WebP signature', () => {
      // "RIFF" + size (4 bytes) + "WEBP"
      const data = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);
      expect(isValidWebpSignature(data)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(isValidWebpSignature(data)).toBe(false);
    });

    it('should return false for empty data', () => {
      const data = new Uint8Array([]);
      expect(isValidWebpSignature(data)).toBe(false);
    });

    it('should return error for invalid signature', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('EXIF chunk parsing', () => {
    it('should find EXIF chunk in valid WebP', () => {
      const data = loadSample('forge-neo.webp');
      const chunk = findExifChunk(data);

      expect(chunk).not.toBeNull();
      if (chunk) {
        expect(chunk.offset).toBeGreaterThan(0);
        expect(chunk.length).toBeGreaterThan(0);
      }
    });
  });

  describe('sample file tests', () => {
    it('should extract metadata from forge-neo.webp', () => {
      const data = loadSample('forge-neo.webp');
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('forge-neo');
        expect(result.value.segments.length).toBeGreaterThan(0);
        expect(getFirstSegmentData(result)).toContain('Version: neo');
      }
    });

    it('should extract metadata from comfyui-comfy-image-saver.webp', () => {
      const data = loadSample('comfyui-comfy-image-saver.webp');
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(getFirstSegmentData(result)).toContain('Version: ComfyUI');
      }
    });

    it('should extract metadata from comfyui-saveimage-plus.webp', () => {
      const data = loadSample('comfyui-saveimage-plus.webp');
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(getFirstSegmentData(result)).toContain('"prompt"');
      }
    });

    it('should extract metadata from swarmui.webp', () => {
      const data = loadSample('swarmui.webp');
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('swarmui');
        expect(getFirstSegmentData(result)).toContain('sui_image_params');
      }
    });

    it('should extract metadata from novelai-curated.webp', () => {
      const data = loadSample('novelai-curated.webp');
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('novelai');
        // NovelAI WebP uses JSON with Software field
        expect(getFirstSegmentData(result)).toContain('"Software":"NovelAI"');
      }
    });

    it('should extract metadata from novelai-full-3char.webp', () => {
      const data = loadSample('novelai-full-3char.webp');
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('novelai');
      }
    });
  });
});
