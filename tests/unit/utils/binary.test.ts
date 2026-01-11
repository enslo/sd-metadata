import { describe, expect, it } from 'vitest';
import {
  arraysEqual,
  detectFormat,
  isJpeg,
  isPng,
  isWebp,
  readChunkType,
  readUint16,
  readUint24LE,
  readUint32,
  readUint32BE,
  readUint32LE,
  writeUint16,
  writeUint32,
  writeUint32BE,
  writeUint32LE,
} from '../../../src/utils/binary';

describe('Binary Utils - Unit Tests', () => {
  describe('Image format detection', () => {
    describe('isPng', () => {
      it('should detect valid PNG signature', () => {
        const data = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        expect(isPng(data)).toBe(true);
      });

      it('should reject invalid signature', () => {
        const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
        expect(isPng(data)).toBe(false);
      });

      it('should reject empty data', () => {
        const data = new Uint8Array([]);
        expect(isPng(data)).toBe(false);
      });

      it('should reject partial signature', () => {
        const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        expect(isPng(data)).toBe(false);
      });

      it('should reject data shorter than 8 bytes', () => {
        const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]);
        expect(isPng(data)).toBe(false);
      });
    });

    describe('isJpeg', () => {
      it('should detect valid JPEG signature', () => {
        const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
        expect(isJpeg(data)).toBe(true);
      });

      it('should reject invalid signature', () => {
        const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
        expect(isJpeg(data)).toBe(false);
      });

      it('should reject empty data', () => {
        const data = new Uint8Array([]);
        expect(isJpeg(data)).toBe(false);
      });

      it('should accept SOI-only as valid', () => {
        // isJpeg only checks the first 2 bytes (SOI marker)
        const data = new Uint8Array([0xff, 0xd8]); // Only SOI
        expect(isJpeg(data)).toBe(true);
      });

      it('should reject partial signature', () => {
        const data = new Uint8Array([0xff]);
        expect(isJpeg(data)).toBe(false);
      });
    });

    describe('isWebp', () => {
      it('should detect valid WebP signature', () => {
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
        expect(isWebp(data)).toBe(true);
      });

      it('should reject invalid signature', () => {
        const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(isWebp(data)).toBe(false);
      });

      it('should reject empty data', () => {
        const data = new Uint8Array([]);
        expect(isWebp(data)).toBe(false);
      });

      it('should reject partial signature', () => {
        const data = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // Only "RIFF"
        expect(isWebp(data)).toBe(false);
      });

      it('should reject data shorter than 12 bytes', () => {
        const data = new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
        ]);
        expect(isWebp(data)).toBe(false);
      });
    });

    describe('detectFormat', () => {
      it('should detect PNG format', () => {
        const data = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        expect(detectFormat(data)).toBe('png');
      });

      it('should detect JPEG format', () => {
        const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
        expect(detectFormat(data)).toBe('jpeg');
      });

      it('should detect WebP format', () => {
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
        expect(detectFormat(data)).toBe('webp');
      });

      it('should return null for unknown format', () => {
        const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(detectFormat(data)).toBeNull();
      });

      it('should prioritize PNG over others', () => {
        const data = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        expect(detectFormat(data)).toBe('png');
      });
    });
  });

  describe('Integer reading', () => {
    describe('readUint16', () => {
      it('should read big-endian uint16', () => {
        const data = new Uint8Array([0x12, 0x34]);
        expect(readUint16(data, 0, false)).toBe(0x1234);
      });

      it('should read little-endian uint16', () => {
        const data = new Uint8Array([0x34, 0x12]);
        expect(readUint16(data, 0, true)).toBe(0x1234);
      });

      it('should read from offset', () => {
        const data = new Uint8Array([0xff, 0xff, 0x12, 0x34]);
        expect(readUint16(data, 2, false)).toBe(0x1234);
      });
    });

    describe('readUint24LE', () => {
      it('should read 24-bit little-endian integer', () => {
        const data = new Uint8Array([0x78, 0x56, 0x34]);
        expect(readUint24LE(data, 0)).toBe(0x345678);
      });

      it('should read from offset', () => {
        const data = new Uint8Array([0xff, 0x78, 0x56, 0x34]);
        expect(readUint24LE(data, 1)).toBe(0x345678);
      });
    });

    describe('readUint32BE', () => {
      it('should read big-endian uint32', () => {
        const data = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
        expect(readUint32BE(data, 0)).toBe(0x12345678);
      });

      it('should read from offset', () => {
        const data = new Uint8Array([0xff, 0xff, 0x12, 0x34, 0x56, 0x78]);
        expect(readUint32BE(data, 2)).toBe(0x12345678);
      });
    });

    describe('readUint32LE', () => {
      it('should read little-endian uint32', () => {
        const data = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
        expect(readUint32LE(data, 0)).toBe(0x12345678);
      });

      it('should read from offset', () => {
        const data = new Uint8Array([0xff, 0xff, 0x78, 0x56, 0x34, 0x12]);
        expect(readUint32LE(data, 2)).toBe(0x12345678);
      });
    });

    describe('readUint32', () => {
      it('should read big-endian uint32', () => {
        const data = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
        expect(readUint32(data, 0, false)).toBe(0x12345678);
      });

      it('should read little-endian uint32', () => {
        const data = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
        expect(readUint32(data, 0, true)).toBe(0x12345678);
      });
    });

    describe('readChunkType', () => {
      it('should read 4-character ASCII string', () => {
        const data = new Uint8Array([0x49, 0x48, 0x44, 0x52]); // "IHDR"
        expect(readChunkType(data, 0)).toBe('IHDR');
      });

      it('should read from offset', () => {
        const data = new Uint8Array([0xff, 0xff, 0x49, 0x48, 0x44, 0x52]);
        expect(readChunkType(data, 2)).toBe('IHDR');
      });
    });
  });

  describe('Integer writing', () => {
    describe('writeUint16', () => {
      it('should write big-endian uint16', () => {
        const data = new Uint8Array(2);
        writeUint16(data, 0, 0x1234, false);
        expect(data).toEqual(new Uint8Array([0x12, 0x34]));
      });

      it('should write little-endian uint16', () => {
        const data = new Uint8Array(2);
        writeUint16(data, 0, 0x1234, true);
        expect(data).toEqual(new Uint8Array([0x34, 0x12]));
      });

      it('should write to offset', () => {
        const data = new Uint8Array(4);
        writeUint16(data, 2, 0x1234, false);
        expect(data).toEqual(new Uint8Array([0x00, 0x00, 0x12, 0x34]));
      });
    });

    describe('writeUint32BE', () => {
      it('should write big-endian uint32', () => {
        const data = new Uint8Array(4);
        writeUint32BE(data, 0, 0x12345678);
        expect(data).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
      });

      it('should write to offset', () => {
        const data = new Uint8Array(6);
        writeUint32BE(data, 2, 0x12345678);
        expect(data).toEqual(
          new Uint8Array([0x00, 0x00, 0x12, 0x34, 0x56, 0x78]),
        );
      });
    });

    describe('writeUint32LE', () => {
      it('should write little-endian uint32', () => {
        const data = new Uint8Array(4);
        writeUint32LE(data, 0, 0x12345678);
        expect(data).toEqual(new Uint8Array([0x78, 0x56, 0x34, 0x12]));
      });

      it('should write to offset', () => {
        const data = new Uint8Array(6);
        writeUint32LE(data, 2, 0x12345678);
        expect(data).toEqual(
          new Uint8Array([0x00, 0x00, 0x78, 0x56, 0x34, 0x12]),
        );
      });
    });

    describe('writeUint32', () => {
      it('should write big-endian uint32', () => {
        const data = new Uint8Array(4);
        writeUint32(data, 0, 0x12345678, false);
        expect(data).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x78]));
      });

      it('should write little-endian uint32', () => {
        const data = new Uint8Array(4);
        writeUint32(data, 0, 0x12345678, true);
        expect(data).toEqual(new Uint8Array([0x78, 0x56, 0x34, 0x12]));
      });
    });
  });

  describe('Array utilities', () => {
    describe('arraysEqual', () => {
      it('should return true for equal arrays', () => {
        const a = new Uint8Array([1, 2, 3, 4]);
        const b = new Uint8Array([1, 2, 3, 4]);
        expect(arraysEqual(a, b)).toBe(true);
      });

      it('should return false for different lengths', () => {
        const a = new Uint8Array([1, 2, 3]);
        const b = new Uint8Array([1, 2, 3, 4]);
        expect(arraysEqual(a, b)).toBe(false);
      });

      it('should return false for different content', () => {
        const a = new Uint8Array([1, 2, 3, 4]);
        const b = new Uint8Array([1, 2, 3, 5]);
        expect(arraysEqual(a, b)).toBe(false);
      });

      it('should return true for empty arrays', () => {
        const a = new Uint8Array([]);
        const b = new Uint8Array([]);
        expect(arraysEqual(a, b)).toBe(true);
      });

      it('should handle arrays with zeros', () => {
        const a = new Uint8Array([0, 0, 0, 0]);
        const b = new Uint8Array([0, 0, 0, 0]);
        expect(arraysEqual(a, b)).toBe(true);
      });
    });
  });

  describe('Round-trip tests', () => {
    it('should preserve uint16 value (big-endian)', () => {
      const data = new Uint8Array(2);
      const value = 0x1234;
      writeUint16(data, 0, value, false);
      expect(readUint16(data, 0, false)).toBe(value);
    });

    it('should preserve uint16 value (little-endian)', () => {
      const data = new Uint8Array(2);
      const value = 0x1234;
      writeUint16(data, 0, value, true);
      expect(readUint16(data, 0, true)).toBe(value);
    });

    it('should preserve uint32 value (big-endian)', () => {
      const data = new Uint8Array(4);
      const value = 0x12345678;
      writeUint32BE(data, 0, value);
      expect(readUint32BE(data, 0)).toBe(value);
    });

    it('should preserve uint32 value (little-endian)', () => {
      const data = new Uint8Array(4);
      const value = 0x12345678;
      writeUint32LE(data, 0, value);
      expect(readUint32LE(data, 0)).toBe(value);
    });
  });
});
