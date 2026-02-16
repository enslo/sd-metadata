import { describe, expect, it } from 'vitest';
import {
  buildEmbedText,
  formatRaw,
  stringify,
} from '../../../src/api/stringify';
import type {
  EmbedMetadata,
  ParseResult,
  RawMetadata,
  StandardMetadata,
} from '../../../src/types';

// ============================================================================
// buildEmbedText
// ============================================================================

describe('buildEmbedText - Unit Tests', () => {
  describe('basic serialization', () => {
    it('should serialize prompt and negativePrompt only', () => {
      const metadata: EmbedMetadata = {
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres, bad quality',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'masterpiece, 1girl',
        'Negative prompt: lowres, bad quality',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should omit negative prompt when empty', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test prompt',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText(metadata);

      expect(result).toBe('test prompt');
    });

    it('should normalize CRLF to LF in prompts', () => {
      const metadata: EmbedMetadata = {
        prompt: 'line1\r\nline2',
        negativePrompt: 'neg1\r\nneg2',
        width: 512,
        height: 512,
      };

      const result = buildEmbedText(metadata);

      expect(result).not.toContain('\r');
      expect(result).toContain('line1\nline2');
      expect(result).toContain('Negative prompt: neg1\nneg2');
    });
  });

  describe('sampling settings', () => {
    it('should output all sampling fields in settings line', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 768,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          scheduler: 'Automatic',
          cfg: 7.5,
          seed: 123456,
          clipSkip: 2,
        },
        model: {
          name: 'model-v1',
          hash: 'abc123',
        },
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        'Steps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7.5, Seed: 123456, Size: 512x768, Model hash: abc123, Model: model-v1, Clip skip: 2',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should include hires settings in settings line', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        hires: {
          scale: 2,
          upscaler: 'Latent',
          steps: 10,
          denoise: 0.5,
        },
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        'Size: 512x512, Denoising strength: 0.5, Hires upscale: 2, Hires steps: 10, Hires upscaler: Latent',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should merge upscale into hires format', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        upscale: {
          scale: 2,
          upscaler: 'ESRGAN-4x',
        },
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        'Size: 512x512, Hires upscale: 2, Hires upscaler: ESRGAN-4x',
      ].join('\n');

      expect(result).toBe(expected);
    });
  });

  describe('extras handling', () => {
    it('should append extras to settings line', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
        },
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Version: 'v1.10.0', 'Lora hashes': 'abc123' },
      });

      const expected = [
        'test',
        'Steps: 20, Sampler: Euler a, Size: 512x512, Version: v1.10.0, Lora hashes: abc123',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should override structured fields with extras at their position', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          cfg: 7,
        },
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 30, Version: 'v1.0' },
      });

      // Steps: 30 should be at position 1 (where structured Steps would be)
      // Version should be at the end
      const expected = [
        'test',
        'Steps: 30, Sampler: Euler a, CFG scale: 7, Size: 512x512, Version: v1.0',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should override multiple structured fields with extras', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
          sampler: 'Euler a',
          cfg: 7,
          seed: 42,
        },
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 30, Seed: 999, Version: 'v1.0' },
      });

      const expected = [
        'test',
        'Steps: 30, Sampler: Euler a, CFG scale: 7, Seed: 999, Size: 512x512, Version: v1.0',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should build settings line from extras only (no sampling)', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 20, Sampler: 'DPM++ 2M', Version: 'v1.0' },
      });

      const expected = [
        'test',
        'Steps: 20, Sampler: DPM++ 2M, Version: v1.0',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should handle empty extras object same as no extras', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        sampling: { steps: 20 },
      };

      const withEmpty = buildEmbedText({ ...metadata, extras: {} });
      const withoutExtras = buildEmbedText(metadata);

      expect(withEmpty).toBe(withoutExtras);
    });

    it('should handle numeric extras values', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      const result = buildEmbedText({
        ...metadata,
        extras: { Steps: 20, 'CFG scale': 7.5 },
      });

      const expected = ['test', 'Steps: 20, CFG scale: 7.5'].join('\n');

      expect(result).toBe(expected);
    });
  });

  describe('character prompts', () => {
    it('should include character prompts between positive and negative prompts', () => {
      const metadata: EmbedMetadata = {
        prompt: 'main prompt',
        negativePrompt: 'bad quality',
        width: 1024,
        height: 1024,
        characterPrompts: [
          {
            prompt: 'girl, hatsune miku',
            center: { x: 0.5, y: 0.3 },
          },
          {
            prompt: 'boy, kagamine len',
            center: { x: 0.7, y: 0.7 },
          },
        ],
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'main prompt',
        '# Character 1 [0.5, 0.3]:',
        'girl, hatsune miku',
        '# Character 2 [0.7, 0.7]:',
        'boy, kagamine len',
        'Negative prompt: bad quality',
        'Size: 1024x1024',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should handle character prompts without coordinates', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [{ prompt: 'character without coords' }],
      };

      const result = buildEmbedText(metadata);

      const expected = [
        'test',
        '# Character 1:',
        'character without coords',
        'Size: 512x512',
      ].join('\n');

      expect(result).toBe(expected);
    });

    it('should skip empty characterPrompts array', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [],
      };

      const result = buildEmbedText(metadata);

      expect(result).not.toContain('# Character');
    });

    it('should normalize line endings in character prompts', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
        characterPrompts: [
          {
            prompt: 'char1\r\nchar2',
            center: { x: 0.5, y: 0.5 },
          },
        ],
      };

      const result = buildEmbedText(metadata);

      expect(result).not.toContain('\r');
      expect(result).toContain('char1\nchar2');
    });
  });
});

// ============================================================================
// formatRaw
// ============================================================================

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

// ============================================================================
// stringify
// ============================================================================

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
