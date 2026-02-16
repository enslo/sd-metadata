import { describe, expect, it } from 'vitest';
import { formatRaw } from '../../../src/api/stringify';
import type { RawMetadata } from '../../../src/types';

describe('formatRaw - Unit Tests', () => {
  describe('PNG format', () => {
    it('should format single tEXt chunk', () => {
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'tEXt',
            keyword: 'Comment',
            text: 'Simple ASCII text',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('Simple ASCII text');
    });

    it('should format single iTXt chunk', () => {
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'iTXt',
            keyword: 'Comment',
            compressionFlag: 0,
            compressionMethod: 0,
            languageTag: '',
            translatedKeyword: '',
            text: 'GIMPで再保存しただけ',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('GIMPで再保存しただけ');
    });

    it('should join multiple chunks with double newline', () => {
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'tEXt',
            keyword: 'parameters',
            text: 'masterpiece, 1girl',
          },
          {
            type: 'tEXt',
            keyword: 'Comment',
            text: '{"key": "value"}',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('masterpiece, 1girl\n\n{"key": "value"}');
    });

    it('should handle empty chunks array', () => {
      const raw: RawMetadata = {
        format: 'png',
        chunks: [],
      };

      const result = formatRaw(raw);

      expect(result).toBe('');
    });

    it('should handle tEXt chunk with non-ASCII (edge case)', () => {
      // Some tools incorrectly store non-ASCII in tEXt chunks
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'tEXt',
            keyword: 'Comment',
            text: '日本語テキスト',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('日本語テキスト');
    });
  });

  describe('JPEG format', () => {
    it('should format single segment', () => {
      const raw: RawMetadata = {
        format: 'jpeg',
        segments: [
          {
            source: { type: 'jpegCom' },
            data: 'GIMPで再保存しただけ',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('GIMPで再保存しただけ');
    });

    it('should join multiple segments with double newline', () => {
      const raw: RawMetadata = {
        format: 'jpeg',
        segments: [
          {
            source: { type: 'jpegCom' },
            data: 'First segment',
          },
          {
            source: { type: 'exifUserComment' },
            data: 'Second segment',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('First segment\n\nSecond segment');
    });

    it('should handle empty segments array', () => {
      const raw: RawMetadata = {
        format: 'jpeg',
        segments: [],
      };

      const result = formatRaw(raw);

      expect(result).toBe('');
    });
  });

  describe('WebP format', () => {
    it('should format single segment', () => {
      const raw: RawMetadata = {
        format: 'webp',
        segments: [
          {
            source: { type: 'exifImageDescription' },
            data: 'GIMPで再保存しただけ',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('GIMPで再保存しただけ');
    });

    it('should join multiple segments with double newline', () => {
      const raw: RawMetadata = {
        format: 'webp',
        segments: [
          {
            source: { type: 'exifImageDescription' },
            data: 'Description',
          },
          {
            source: { type: 'exifUserComment' },
            data: 'Comment',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('Description\n\nComment');
    });

    it('should handle empty segments array', () => {
      const raw: RawMetadata = {
        format: 'webp',
        segments: [],
      };

      const result = formatRaw(raw);

      expect(result).toBe('');
    });
  });

  describe('content preservation', () => {
    it('should preserve newlines within text', () => {
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'tEXt',
            keyword: 'parameters',
            text: 'line1\nline2\nline3',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('line1\nline2\nline3');
    });

    it('should preserve JSON content', () => {
      const jsonContent = '{"prompt": "1girl", "steps": 20}';
      const raw: RawMetadata = {
        format: 'jpeg',
        segments: [
          {
            source: { type: 'exifUserComment' },
            data: jsonContent,
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe(jsonContent);
    });

    it('should preserve unicode characters', () => {
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'iTXt',
            keyword: 'Comment',
            compressionFlag: 0,
            compressionMethod: 0,
            languageTag: 'ja',
            translatedKeyword: '',
            text: '日本語テキスト 🎨✨',
          },
        ],
      };

      const result = formatRaw(raw);

      expect(result).toBe('日本語テキスト 🎨✨');
    });
  });
});
