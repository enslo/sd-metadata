/**
 * Tests for ImageInput type support (Uint8Array | ArrayBuffer)
 *
 * Verifies that all public API functions accept both Uint8Array and ArrayBuffer
 * as input, providing better DX for browser users.
 */

import { describe, expect, it } from 'vitest';
import { read, write, writeAsWebUI } from '../../../src';
import type { GenerationMetadata, ParseResult } from '../../../src';

/**
 * Create a minimal valid PNG image for testing
 *
 * Creates a 1x1 pixel PNG with no metadata.
 */
function createMinimalPng(): Uint8Array {
  // PNG signature + IHDR + IDAT + IEND
  // This is a valid 1x1 transparent PNG
  return new Uint8Array([
    // PNG signature
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    // IHDR chunk (13 bytes)
    0x00,
    0x00,
    0x00,
    0x0d, // Length: 13
    0x49,
    0x48,
    0x44,
    0x52, // Type: IHDR
    0x00,
    0x00,
    0x00,
    0x01, // Width: 1
    0x00,
    0x00,
    0x00,
    0x01, // Height: 1
    0x08,
    0x06, // Bit depth: 8, Color type: 6 (RGBA)
    0x00,
    0x00,
    0x00, // Compression, Filter, Interlace
    0x1f,
    0x15,
    0xc4,
    0x89, // CRC
    // IDAT chunk (minimal compressed data)
    0x00,
    0x00,
    0x00,
    0x0a, // Length: 10
    0x49,
    0x44,
    0x41,
    0x54, // Type: IDAT
    0x78,
    0x9c,
    0x63,
    0x00,
    0x01,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01, // Compressed data
    0x0d,
    0x0a,
    0x2d,
    0xb4, // CRC
    // IEND chunk
    0x00,
    0x00,
    0x00,
    0x00, // Length: 0
    0x49,
    0x45,
    0x4e,
    0x44, // Type: IEND
    0xae,
    0x42,
    0x60,
    0x82, // CRC
  ]);
}

/**
 * Convert Uint8Array to ArrayBuffer (simulating browser File.arrayBuffer())
 */
function toArrayBuffer(uint8Array: Uint8Array): ArrayBuffer {
  // Create a new ArrayBuffer and copy the data
  // This ensures we have a standalone ArrayBuffer, not just a view's buffer
  const buffer = new ArrayBuffer(uint8Array.length);
  new Uint8Array(buffer).set(uint8Array);
  return buffer;
}

describe('ImageInput type support', () => {
  describe('read()', () => {
    it('should accept Uint8Array input', () => {
      const pngData = createMinimalPng();
      const result = read(pngData);

      // Should not error, should return empty (no metadata in minimal PNG)
      expect(result.status).toBe('empty');
    });

    it('should accept ArrayBuffer input', () => {
      const pngData = createMinimalPng();
      const arrayBuffer = toArrayBuffer(pngData);
      const result = read(arrayBuffer);

      // Should produce the same result as Uint8Array
      expect(result.status).toBe('empty');
    });

    it('should return invalid for unknown format with ArrayBuffer', () => {
      const invalidData = new ArrayBuffer(10);
      const result = read(invalidData);

      expect(result.status).toBe('invalid');
    });
  });

  describe('write()', () => {
    it('should accept ArrayBuffer as target image', () => {
      const pngData = createMinimalPng();
      const arrayBuffer = toArrayBuffer(pngData);

      // Write empty metadata (strip all)
      const emptyResult: ParseResult = { status: 'empty' };
      const result = write(arrayBuffer, emptyResult);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeInstanceOf(Uint8Array);
      }
    });

    it('should return error for unsupported format with ArrayBuffer', () => {
      const invalidData = new ArrayBuffer(10);
      const emptyResult: ParseResult = { status: 'empty' };
      const result = write(invalidData, emptyResult);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });
  });

  describe('writeAsWebUI()', () => {
    it('should accept ArrayBuffer as target image', () => {
      const pngData = createMinimalPng();
      const arrayBuffer = toArrayBuffer(pngData);

      const metadata: GenerationMetadata = {
        software: 'sd-webui',
        prompt: 'test prompt',
        negativePrompt: '',
        width: 512,
        height: 512,
      };

      const result = writeAsWebUI(arrayBuffer, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeInstanceOf(Uint8Array);
      }
    });

    it('should return error for unsupported format with ArrayBuffer', () => {
      const invalidData = new ArrayBuffer(10);

      const metadata: GenerationMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
      };

      const result = writeAsWebUI(invalidData, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });
  });

  describe('round-trip with ArrayBuffer', () => {
    it('should read metadata written via ArrayBuffer input', () => {
      const pngData = createMinimalPng();
      const arrayBuffer = toArrayBuffer(pngData);

      // Write metadata using ArrayBuffer input
      const metadata: GenerationMetadata = {
        software: 'sd-webui',
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres',
        width: 512,
        height: 768,
        sampling: {
          seed: 12345,
          steps: 20,
          cfg: 7,
          sampler: 'Euler a',
        },
      };

      const writeResult = writeAsWebUI(arrayBuffer, metadata);
      expect(writeResult.ok).toBe(true);

      if (writeResult.ok) {
        // Read back the metadata (also using ArrayBuffer)
        const readBuffer = toArrayBuffer(writeResult.value);
        const readResult = read(readBuffer);

        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe('masterpiece, 1girl');
          expect(readResult.metadata.negativePrompt).toBe('lowres');
          expect(readResult.metadata.sampling?.seed).toBe(12345);
        }
      }
    });
  });
});
