import { describe, expect, it } from 'vitest';
import { readPngMetadata } from '../../../src/readers/png';
import type { ITXtChunk, PngTextChunk, TExtChunk } from '../../../src/types';
import { writePngMetadata } from '../../../src/writers/png';
import { createMinimalPng } from '../../helpers/minimal-images';

describe('writePngMetadata - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for invalid PNG', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      const chunks: PngTextChunk[] = [];
      const result = writePngMetadata(data, chunks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });

    it('should return error for PNG without IHDR', () => {
      // PNG signature only, no IHDR
      const data = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const chunks: PngTextChunk[] = [];
      const result = writePngMetadata(data, chunks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('noIhdrChunk');
      }
    });
  });

  describe('chunk writing', () => {
    it('should write tEXt chunk', () => {
      const png = createMinimalPng();
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'Software',
          text: 'TestApp',
        } satisfies TExtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify we can read it back
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          expect(readResult.value.at(0)).toMatchObject({
            type: 'tEXt',
            keyword: 'Software',
            text: 'TestApp',
          });
        }
      }
    });

    it('should write iTXt chunk', () => {
      const png = createMinimalPng();
      const chunks: PngTextChunk[] = [
        {
          type: 'iTXt',
          keyword: 'Comment',
          compressionFlag: 0,
          compressionMethod: 0,
          languageTag: '',
          translatedKeyword: '',
          text: 'Test comment',
        } satisfies ITXtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          expect(readResult.value.at(0)).toMatchObject({
            type: 'iTXt',
            keyword: 'Comment',
            text: 'Test comment',
          });
        }
      }
    });

    it('should write multiple chunks', () => {
      const png = createMinimalPng();
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'Software',
          text: 'TestApp',
        } satisfies TExtChunk,
        {
          type: 'tEXt',
          keyword: 'Comment',
          text: 'Hello',
        } satisfies TExtChunk,
        {
          type: 'iTXt',
          keyword: 'parameters',
          compressionFlag: 0,
          compressionMethod: 0,
          languageTag: '',
          translatedKeyword: '',
          text: 'key=value',
        } satisfies ITXtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(3);
          expect(readResult.value.at(0)?.keyword).toBe('Software');
          expect(readResult.value.at(1)?.keyword).toBe('Comment');
          expect(readResult.value.at(2)?.keyword).toBe('parameters');
        }
      }
    });

    it('should write empty chunks array (strip metadata)', () => {
      const png = createMinimalPng();

      // First, add metadata
      const chunksToAdd: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'Software',
          text: 'TestApp',
        } satisfies TExtChunk,
        {
          type: 'tEXt',
          keyword: 'Comment',
          text: 'To be removed',
        } satisfies TExtChunk,
      ];
      const resultWithMetadata = writePngMetadata(png, chunksToAdd);
      expect(resultWithMetadata.ok).toBe(true);
      if (!resultWithMetadata.ok) return;

      // Verify metadata was added
      const readBeforeStrip = readPngMetadata(resultWithMetadata.value);
      expect(readBeforeStrip.ok).toBe(true);
      if (readBeforeStrip.ok) {
        expect(readBeforeStrip.value).toHaveLength(2);
      }

      // Now strip metadata with empty array
      const emptyChunks: PngTextChunk[] = [];
      const resultStripped = writePngMetadata(
        resultWithMetadata.value,
        emptyChunks,
      );

      expect(resultStripped.ok).toBe(true);
      if (resultStripped.ok) {
        const readResult = readPngMetadata(resultStripped.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(0);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty keyword and text', () => {
      const png = createMinimalPng();
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: '',
          text: '',
        } satisfies TExtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          expect(readResult.value.at(0)?.keyword).toBe('');
          expect(readResult.value.at(0)?.text).toBe('');
        }
      }
    });

    it('should handle special characters', () => {
      const png = createMinimalPng();
      const specialText = 'Hello\\nWorld\\t"quotes"';
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'Comment',
          text: specialText,
        } satisfies TExtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.at(0)?.text).toBe(specialText);
        }
      }
    });

    it('should handle Unicode in tEXt (for non-compliant tool compatibility)', () => {
      const png = createMinimalPng();
      // Per PNG spec, tEXt should use Latin-1, but some tools (e.g., TensorArt)
      // incorrectly write UTF-8. We write UTF-8 to maintain round-trip compatibility.
      const unicodeText = 'こんにちは世界 🌏';
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'Comment',
          text: unicodeText,
        } satisfies TExtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          // Verify Unicode survives the round-trip
          expect(readResult.value.at(0)?.text).toBe(unicodeText);
        }
      }
    });

    it('should handle Unicode in iTXt', () => {
      const png = createMinimalPng();
      const unicodeText = 'こんにちは世界 🌏 Hello';
      const chunks: PngTextChunk[] = [
        {
          type: 'iTXt',
          keyword: 'Comment',
          compressionFlag: 0,
          compressionMethod: 0,
          languageTag: '',
          translatedKeyword: '',
          text: unicodeText,
        } satisfies ITXtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.at(0)?.text).toBe(unicodeText);
        }
      }
    });
  });

  describe('round-trip preservation', () => {
    it('should preserve iTXt metadata fields', () => {
      const png = createMinimalPng();
      const chunks: PngTextChunk[] = [
        {
          type: 'iTXt',
          keyword: 'Description',
          compressionFlag: 0,
          compressionMethod: 0,
          languageTag: 'en-US',
          translatedKeyword: 'Description',
          text: 'Test description',
        } satisfies ITXtChunk,
      ];

      const result = writePngMetadata(png, chunks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = readPngMetadata(result.value);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toHaveLength(1);
          const chunk = readResult.value.at(0);
          expect(chunk?.type).toBe('iTXt');
          if (chunk?.type === 'iTXt') {
            expect(chunk.keyword).toBe('Description');
            expect(chunk.languageTag).toBe('en-US');
            expect(chunk.translatedKeyword).toBe('Description');
            expect(chunk.text).toBe('Test description');
          }
        }
      }
    });
  });
});
