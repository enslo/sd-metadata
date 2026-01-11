import { describe, expect, it } from 'vitest';
import { convertMetadata } from '../../../src/converters';
import type { ParseResult } from '../../../src/types';

describe('Blind Conversion', () => {
  describe('force: false (default)', () => {
    it('should return error for unrecognized format without force option', () => {
      const parseResult: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'png',
          chunks: [{ type: 'tEXt', keyword: 'custom', text: 'value' }],
        },
      };

      const result = convertMetadata(parseResult, 'jpeg', false);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedSoftware');
        if (result.error.type === 'unsupportedSoftware') {
          expect(result.error.software).toBe('unknown');
        }
      }
    });
  });

  describe('force: true', () => {
    it('should combine multiple chunks into single JSON UserComment', () => {
      const parseResult: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'png',
          chunks: [
            { type: 'tEXt', keyword: 'key1', text: 'value1' },
            { type: 'tEXt', keyword: 'key2', text: 'value2' },
          ],
        },
      };

      const result = convertMetadata(parseResult, 'jpeg', true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Only 1 segment (not 2!)
        expect(result.value.format).toBe('jpeg');
        if (result.value.format === 'jpeg' || result.value.format === 'webp') {
          expect(result.value.segments).toHaveLength(1);
          expect(result.value.segments[0]?.source.type).toBe('exifUserComment');

          // Check JSON content
          const data = JSON.parse(result.value.segments[0]?.data ?? '{}');
          expect(data.key1).toBe('value1');
          expect(data.key2).toBe('value2');
        }
      }
    });

    it('should convert to WebP format', () => {
      const parseResult: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'png',
          chunks: [{ type: 'tEXt', keyword: 'custom', text: 'data' }],
        },
      };

      const result = convertMetadata(parseResult, 'webp', true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('webp');
        if (result.value.format === 'webp' || result.value.format === 'jpeg') {
          expect(result.value.segments).toHaveLength(1);
          expect(result.value.segments[0]?.source.type).toBe('exifUserComment');
        }
      }
    });

    it('should round-trip correctly (PNG → JPEG → PNG)', () => {
      const original: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'png',
          chunks: [
            { type: 'tEXt', keyword: 'custom', text: 'data' },
            { type: 'tEXt', keyword: 'another', text: 'value' },
          ],
        },
      };

      // PNG → JPEG
      const toJpeg = convertMetadata(original, 'jpeg', true);
      expect(toJpeg.ok).toBe(true);
      if (!toJpeg.ok) return;

      // JPEG → PNG (round-trip)
      const toPng = convertMetadata(
        { status: 'unrecognized', raw: toJpeg.value },
        'png',
        true,
      );

      expect(toPng.ok).toBe(true);
      if (toPng.ok) {
        expect(toPng.value.format).toBe('png');
        if (toPng.value.format === 'png') {
          expect(toPng.value.chunks).toHaveLength(2);

          const keywords = toPng.value.chunks.map((c) => c.keyword);
          expect(keywords).toContain('custom');
          expect(keywords).toContain('another');

          const customChunk = toPng.value.chunks.find(
            (c) => c.keyword === 'custom',
          );
          expect(customChunk?.text).toBe('data');
        }
      }
    });

    it('should handle same format conversion', () => {
      const parseResult: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'png',
          chunks: [{ type: 'tEXt', keyword: 'test', text: 'value' }],
        },
      };

      const result = convertMetadata(parseResult, 'png', true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should return as-is for same format
        expect(result.value.format).toBe('png');
        if (result.value.format === 'png') {
          expect(result.value.chunks).toHaveLength(1);
        }
      }
    });

    it('should handle JPEG to PNG conversion', () => {
      const parseResult: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'jpeg',
          segments: [
            {
              source: { type: 'exifUserComment' },
              data: JSON.stringify({ key1: 'value1', key2: 'value2' }),
            },
          ],
        },
      };

      const result = convertMetadata(parseResult, 'png', true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('png');
        if (result.value.format === 'png') {
          expect(result.value.chunks).toHaveLength(2);

          const keywords = result.value.chunks.map((c) => c.keyword);
          expect(keywords).toContain('key1');
          expect(keywords).toContain('key2');
        }
      }
    });

    it('should handle non-JSON UserComment as fallback', () => {
      const parseResult: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'jpeg',
          segments: [
            {
              source: { type: 'exifUserComment' },
              data: 'plain text data',
            },
          ],
        },
      };

      const result = convertMetadata(parseResult, 'png', true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        if (result.value.format === 'png') {
          expect(result.value.chunks).toHaveLength(1);
          expect(result.value.chunks[0]?.keyword).toBe('metadata');
          expect(result.value.chunks[0]?.text).toBe('plain text data');
        }
      }
    });
  });
});
