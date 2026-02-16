import { describe, expect, it } from 'vitest';
import { buildEmbedText } from '../../../src/serializers/embed';
import { formatRaw } from '../../../src/serializers/raw';
import { stringify } from '../../../src/serializers/stringify';
import type {
  EmbedMetadata,
  ParseResult,
  RawMetadata,
  StandardMetadata,
} from '../../../src/types';

describe('stringify - Unit Tests', () => {
  describe('success status', () => {
    it('should produce same output as buildEmbedText', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres, bad anatomy',
        width: 512,
        height: 768,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          cfg: 7,
          seed: 12345,
        },
        model: {
          name: 'animagine-xl',
          hash: 'abc123',
        },
      };
      const raw: RawMetadata = {
        format: 'png',
        chunks: [{ type: 'tEXt', keyword: 'parameters', text: 'raw text' }],
      };
      const result: ParseResult = { status: 'success', metadata, raw };

      expect(stringify(result)).toBe(buildEmbedText(metadata));
    });

    it('should handle minimal metadata', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
      };
      const raw: RawMetadata = {
        format: 'png',
        chunks: [{ type: 'tEXt', keyword: 'parameters', text: 'test' }],
      };
      const result: ParseResult = { status: 'success', metadata, raw };

      expect(stringify(result)).toBe(buildEmbedText(metadata));
    });
  });

  describe('EmbedMetadata input', () => {
    it('should produce same output as buildEmbedText for EmbedMetadata', () => {
      const metadata: EmbedMetadata = {
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres',
        width: 512,
        height: 768,
        sampling: { steps: 20, sampler: 'Euler a', cfg: 7, seed: 12345 },
      };

      expect(stringify(metadata)).toBe(buildEmbedText(metadata));
    });

    it('should include extras in output', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: { steps: 20 },
        extras: { Version: 'v1.10.0' },
      };

      const result = stringify(metadata);

      expect(result).toContain('Version: v1.10.0');
    });
  });

  describe('GenerationMetadata input', () => {
    it('should accept GenerationMetadata directly', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'masterpiece',
        negativePrompt: '',
        width: 512,
        height: 768,
        sampling: { steps: 20, sampler: 'Euler a' },
      };

      expect(stringify(metadata)).toBe(buildEmbedText(metadata));
    });
  });

  describe('unrecognized status', () => {
    it('should produce same output as formatRaw for PNG', () => {
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          { type: 'tEXt', keyword: 'Comment', text: 'Created with GIMP' },
        ],
      };
      const result: ParseResult = { status: 'unrecognized', raw };

      expect(stringify(result)).toBe(formatRaw(raw));
    });

    it('should produce same output as formatRaw for JPEG', () => {
      const raw: RawMetadata = {
        format: 'jpeg',
        segments: [{ source: { type: 'jpegCom' }, data: 'JPEG comment data' }],
      };
      const result: ParseResult = { status: 'unrecognized', raw };

      expect(stringify(result)).toBe(formatRaw(raw));
    });

    it('should produce same output as formatRaw for WebP', () => {
      const raw: RawMetadata = {
        format: 'webp',
        segments: [
          {
            source: { type: 'exifImageDescription' },
            data: 'WebP description',
          },
        ],
      };
      const result: ParseResult = { status: 'unrecognized', raw };

      expect(stringify(result)).toBe(formatRaw(raw));
    });
  });

  describe('empty status', () => {
    it('should return empty string', () => {
      const result: ParseResult = { status: 'empty' };

      expect(stringify(result)).toBe('');
    });
  });

  describe('invalid status', () => {
    it('should return empty string', () => {
      const result: ParseResult = { status: 'invalid' };

      expect(stringify(result)).toBe('');
    });

    it('should return empty string even with message', () => {
      const result: ParseResult = {
        status: 'invalid',
        message: 'Unknown image format',
      };

      expect(stringify(result)).toBe('');
    });
  });
});
