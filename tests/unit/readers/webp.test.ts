import { describe, expect, it } from 'vitest';
import { findExifChunk, readWebpMetadata } from '../../../src/readers/webp';

/**
 * Create minimal valid WebP file (RIFF header + VP8 chunk)
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

describe('readWebpMetadata - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for invalid WebP', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('EXIF chunk finding', () => {
    it('should return null for WebP without EXIF chunk', () => {
      const data = createMinimalWebp();
      const chunk = findExifChunk(data);

      expect(chunk).toBeNull();
    });

    it('should return null for corrupted WebP', () => {
      // WebP with truncated data
      const data = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0xff,
        0xff,
        0xff,
        0xff, // Invalid huge size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);
      const chunk = findExifChunk(data);

      expect(chunk).toBeNull();
    });
  });

  describe('chunk reading', () => {
    it('should read empty WebP (no metadata)', () => {
      const data = createMinimalWebp();
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle WebP with only VP8 chunk', () => {
      const data = createMinimalWebp();
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should handle truncated WebP header', () => {
      const data = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });

    it('should handle WebP with invalid RIFF size', () => {
      const data = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x01,
        0x00,
        0x00,
        0x00, // Size too small
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);
      const result = readWebpMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should still succeed but return empty metadata
        expect(result.value).toEqual([]);
      }
    });
  });
});
