import { describe, expect, it } from 'vitest';
import { readImageDimensions } from '../../../src/readers/dimensions';

describe('readImageDimensions', () => {
  describe('JPEG', () => {
    it('should return null for truncated input (no RangeError)', () => {
      // SOI + SOF0 marker + length=8 + precision byte only — offset+5 and offset+7 are OOB.
      // Loop condition `offset < data.length - 4` passes but SOF reads beyond the buffer.
      const truncated = new Uint8Array([
        0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x00,
      ]);
      expect(() => readImageDimensions(truncated, 'jpeg')).not.toThrow();
      expect(readImageDimensions(truncated, 'jpeg')).toBeNull();
    });

    it('should return null for empty JPEG', () => {
      expect(
        readImageDimensions(new Uint8Array([0xff, 0xd8]), 'jpeg'),
      ).toBeNull();
    });

    it('should read valid JPEG SOF dimensions', () => {
      // SOI + SOF0: marker(2) + length(2) + precision(1) + height(2) + width(2)
      const data = new Uint8Array([
        0xff,
        0xd8, // SOI
        0xff,
        0xc0, // SOF0
        0x00,
        0x0b, // length = 11
        0x08, // precision
        0x00,
        0x60, // height = 96
        0x00,
        0x80, // width = 128
        0x03, // components
      ]);
      expect(readImageDimensions(data, 'jpeg')).toEqual({
        width: 128,
        height: 96,
      });
    });
  });

  describe('WebP', () => {
    it('should return null for truncated VP8 chunk (no RangeError)', () => {
      // RIFF header + VP8 chunk header (8 bytes) + partial frame tag (3 bytes keyframe with 0x9d01 2a)
      // but missing width/height bytes at start+6 and start+8.
      const data = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x1e,
        0x00,
        0x00,
        0x00, // file size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
        0x56,
        0x50,
        0x38,
        0x20, // VP8 (lossy)
        0x10,
        0x00,
        0x00,
        0x00, // chunk size = 16
        0x00,
        0x00,
        0x00, // frame tag (keyframe: tag & 1 == 0)
        0x9d,
        0x01,
        0x2a, // validation code
        // width/height bytes missing — only 6 bytes past start
      ]);
      expect(() => readImageDimensions(data, 'webp')).not.toThrow();
      expect(readImageDimensions(data, 'webp')).toBeNull();
    });

    it('should return null for truncated VP8L chunk (no RangeError)', () => {
      // VP8L chunk with signature byte (0x2f) but missing the 4-byte bitstream
      const data = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x14,
        0x00,
        0x00,
        0x00, // file size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
        0x56,
        0x50,
        0x38,
        0x4c, // VP8L
        0x05,
        0x00,
        0x00,
        0x00, // chunk size = 5
        0x2f, // VP8L signature — but only 1 byte, readUint32LE at offset+9 is OOB
      ]);
      expect(() => readImageDimensions(data, 'webp')).not.toThrow();
      expect(readImageDimensions(data, 'webp')).toBeNull();
    });
  });

  describe('PNG', () => {
    it('should return null for data shorter than 24 bytes', () => {
      expect(readImageDimensions(new Uint8Array(20), 'png')).toBeNull();
    });
  });
});
