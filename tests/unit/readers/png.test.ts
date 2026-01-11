import { describe, expect, it } from 'vitest';
import { readPngMetadata } from '../../../src/readers/png';
import type { ITXtChunk, TExtChunk } from '../../../src/types';

/**
 * Create a minimal valid PNG with signature and IEND chunk
 */
function createMinimalPng(): Uint8Array {
  return new Uint8Array([
    // PNG signature
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    // IEND chunk (length=0, type=IEND, CRC)
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

/**
 * Create a PNG tEXt chunk
 */
function createTextChunk(keyword: string, text: string): Uint8Array {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const dataLength = keywordBytes.length + 1 + textBytes.length; // +1 for null separator

  const chunk = new Uint8Array(12 + dataLength); // 4 (length) + 4 (type) + data + 4 (CRC)
  const view = new DataView(chunk.buffer);

  // Length
  view.setUint32(0, dataLength, false);

  // Type: tEXt
  chunk[4] = 0x74; // 't'
  chunk[5] = 0x45; // 'E'
  chunk[6] = 0x58; // 'X'
  chunk[7] = 0x74; // 't'

  // Data: keyword + null + text
  chunk.set(keywordBytes, 8);
  chunk[8 + keywordBytes.length] = 0x00; // null separator
  chunk.set(textBytes, 8 + keywordBytes.length + 1);

  // CRC (simplified - just use placeholder)
  view.setUint32(8 + dataLength, 0, false);

  return chunk;
}

/**
 * Create a PNG iTXt chunk (compressed=false, language="", translated="")
 */
function createItxtChunk(keyword: string, text: string): Uint8Array {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  // keyword + null + compression_flag + compression_method + language(empty string+null) + translated(empty string+null) + text
  const dataLength =
    keywordBytes.length + 1 + 1 + 1 + 0 + 1 + 0 + 1 + textBytes.length;

  const chunk = new Uint8Array(12 + dataLength);
  const view = new DataView(chunk.buffer);

  // Length
  view.setUint32(0, dataLength, false);

  // Type: iTXt
  chunk[4] = 0x69; // 'i'
  chunk[5] = 0x54; // 'T'
  chunk[6] = 0x58; // 'X'
  chunk[7] = 0x74; // 't'

  // Data
  let offset = 8;
  chunk.set(keywordBytes, offset);
  offset += keywordBytes.length;
  chunk[offset++] = 0x00; // null separator
  chunk[offset++] = 0x00; // compression flag (0 = uncompressed)
  chunk[offset++] = 0x00; // compression method (must be 0)
  chunk[offset++] = 0x00; // language tag (empty, null-terminated)
  chunk[offset++] = 0x00; // translated keyword (empty, null-terminated)
  chunk.set(textBytes, offset);

  // CRC (placeholder)
  view.setUint32(8 + dataLength, 0, false);

  return chunk;
}

/**
 * Combine PNG signature with chunks
 */
function createPngWithChunks(...chunks: Uint8Array[]): Uint8Array {
  const signature = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const iend = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  const totalLength =
    signature.length +
    chunks.reduce((sum, c) => sum + c.length, 0) +
    iend.length;
  const result = new Uint8Array(totalLength);

  let offset = 0;
  result.set(signature, offset);
  offset += signature.length;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  result.set(iend, offset);

  return result;
}

describe('readPngMetadata - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for invalid PNG', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('chunk reading', () => {
    it('should read empty PNG (no text chunks)', () => {
      const data = createMinimalPng();
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it('should read single tEXt chunk', () => {
      const textChunk = createTextChunk('Software', 'TestApp');
      const data = createPngWithChunks(textChunk);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toMatchObject({
          type: 'tEXt',
          keyword: 'Software',
          text: 'TestApp',
        } satisfies Partial<TExtChunk>);
      }
    });

    it('should read single iTXt chunk', () => {
      const itxtChunk = createItxtChunk('Comment', 'Test comment');
      const data = createPngWithChunks(itxtChunk);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toMatchObject({
          type: 'iTXt',
          keyword: 'Comment',
          text: 'Test comment',
          compressionFlag: 0,
        } satisfies Partial<ITXtChunk>);
      }
    });

    it('should read multiple text chunks', () => {
      const chunk1 = createTextChunk('Software', 'App1');
      const chunk2 = createTextChunk('Comment', 'Hello');
      const chunk3 = createItxtChunk('parameters', 'key=value');
      const data = createPngWithChunks(chunk1, chunk2, chunk3);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0].keyword).toBe('Software');
        expect(result.value[1].keyword).toBe('Comment');
        expect(result.value[2].keyword).toBe('parameters');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty keyword', () => {
      const textChunk = createTextChunk('', 'text content');
      const data = createPngWithChunks(textChunk);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].keyword).toBe('');
        expect(result.value[0].text).toBe('text content');
      }
    });

    it('should handle empty text', () => {
      const textChunk = createTextChunk('Software', '');
      const data = createPngWithChunks(textChunk);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].keyword).toBe('Software');
        expect(result.value[0].text).toBe('');
      }
    });

    it('should handle special characters in text', () => {
      const specialText = 'Hello\\nWorld\\t"quotes"\\u0000null';
      const textChunk = createTextChunk('Comment', specialText);
      const data = createPngWithChunks(textChunk);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].text).toBe(specialText);
      }
    });

    it('should handle Unicode in iTXt chunks', () => {
      const unicodeText = 'こんにちは世界 🌏 Hello';
      const itxtChunk = createItxtChunk('Comment', unicodeText);
      const data = createPngWithChunks(itxtChunk);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].text).toBe(unicodeText);
      }
    });
  });
});
