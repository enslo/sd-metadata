import { describe, expect, it } from 'vitest';
import {
  buildEmbedText,
  formatRaw,
  stringify,
} from '../../../src/api/stringify';
import type {
  EmbedMetadata,
  GenerationMetadata,
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
          seed: '123456',
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
          seed: '42',
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

  describe('LoRAs', () => {
    const loras = [
      {
        name: 'Lora\\LECO_GoodHands.safetensors',
        weight: -0.8,
        hash: 'fe3806374a03',
      },
      { name: 'LECO_BadHands', weight: 0.9, clipWeight: 0.8 },
    ];

    it('should append tags to the prompt and list the hashes on the settings line', () => {
      const metadata: EmbedMetadata = {
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres',
        width: 512,
        height: 512,
        sampling: { steps: 20 },
        hires: { upscaler: 'Latent' },
        loras,
      };

      const expected = [
        'masterpiece, 1girl <lora:LECO_GoodHands:-0.8> <lora:LECO_BadHands:0.8:0.9>',
        'Negative prompt: lowres',
        'Steps: 20, Size: 512x512, Hires upscaler: Latent, Lora hashes: "LECO_GoodHands: fe3806374a03"',
      ].join('\n');

      expect(buildEmbedText(metadata)).toBe(expected);
    });

    it('should put Lora hashes before extras and let extras override it', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
        loras,
        extras: { Version: 'v1.10.1' },
      };
      const prompt =
        'test <lora:LECO_GoodHands:-0.8> <lora:LECO_BadHands:0.8:0.9>';

      expect(buildEmbedText(metadata)).toBe(
        `${prompt}\nLora hashes: "LECO_GoodHands: fe3806374a03", Version: v1.10.1`,
      );
      expect(
        buildEmbedText({
          ...metadata,
          extras: { 'Lora hashes': 'custom', Version: 'v1.10.1' },
        }),
      ).toBe(`${prompt}\nLora hashes: custom, Version: v1.10.1`);
    });

    it('should not double tags the prompt already has', () => {
      const metadata: EmbedMetadata = {
        prompt: '1girl <lora:LECO_GoodHands:-0.8>',
        negativePrompt: '',
        width: 0,
        height: 0,
        loras,
      };

      expect(buildEmbedText(metadata)).toBe(
        '1girl <lora:LECO_GoodHands:-0.8> <lora:LECO_BadHands:0.8:0.9>\nLora hashes: "LECO_GoodHands: fe3806374a03"',
      );
    });

    it('should omit Lora hashes when no LoRA has a hash', () => {
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
        loras: [{ name: 'a', weight: 1 }],
      };

      expect(buildEmbedText(metadata)).toBe('test <lora:a:1>');
    });

    it('should write Civitai resources instead of tags for civitai metadata', () => {
      const metadata: StandardMetadata = {
        software: 'civitai',
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
        sampling: { steps: 20 },
        loras: [
          {
            name: 'urn:air:sdxl:lora:civitai:1547435@1750914',
            weight: 0.4,
            clipWeight: 1,
          },
          { name: 'Detailed anime style - Illustrious V2.0', weight: 0.4 },
        ],
      };

      expect(buildEmbedText(metadata)).toBe(
        'test\nSteps: 20, Civitai resources: [{"type":"lora","weight":0.4,"modelId":1547435,"modelVersionId":1750914},{"type":"lora","weight":0.4,"modelName":"Detailed anime style - Illustrious V2.0"}]',
      );
    });

    it('should write tags for the metadata of other software', () => {
      const metadata: StandardMetadata = {
        software: 'invokeai',
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
        loras: [{ name: 'a', weight: 0.5, hash: 'blake3:abc' }],
      };

      expect(buildEmbedText(metadata)).toBe(
        'test <lora:a:0.5>\nLora hashes: "a: blake3:abc"',
      );
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
    it('should transcribe A1111 text as written, normalizing line endings', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres',
        width: 512,
        height: 768,
        sampling: { steps: 20, seed: '12345' },
      };
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'tEXt',
            keyword: 'parameters',
            text: 'masterpiece, 1girl\r\nNegative prompt: lowres\r\nSteps: 20, Seed: 12345, RNG: CPU, Version: v1.10.1',
          },
        ],
      };
      const result: ParseResult = { status: 'success', metadata, raw };

      expect(stringify(result)).toBe(
        'masterpiece, 1girl\nNegative prompt: lowres\nSteps: 20, Seed: 12345, RNG: CPU, Version: v1.10.1',
      );
    });

    it('should transcribe the Exif UserComment of JPEG and WebP results', () => {
      const metadata: StandardMetadata = {
        software: 'forge',
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
      };

      for (const format of ['jpeg', 'webp'] as const) {
        const raw: RawMetadata = {
          format,
          segments: [
            {
              source: { type: 'exifUserComment' },
              data: 'test\nSteps: 20, Version: f2.0',
            },
          ],
        };

        expect(stringify({ status: 'success', metadata, raw })).toBe(
          'test\nSteps: 20, Version: f2.0',
        );
      }
    });

    it('should rebuild JSON-scheme results of A1111-family software', () => {
      const metadata: StandardMetadata = {
        software: 'fooocus',
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
        sampling: { steps: 30 },
      };
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          { type: 'tEXt', keyword: 'parameters', text: '{"steps": 30}' },
        ],
      };

      expect(stringify({ status: 'success', metadata, raw })).toBe(
        'test\nSteps: 30',
      );
    });

    it('should rebuild results of other software from the metadata', () => {
      const metadata: GenerationMetadata = {
        software: 'comfyui',
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
        sampling: { steps: 20 },
        nodes: {},
      };
      const raw: RawMetadata = {
        format: 'png',
        chunks: [
          {
            type: 'tEXt',
            keyword: 'parameters',
            text: 'unknown\nSteps: 20, Version: ComfyUI',
          },
        ],
      };

      expect(stringify({ status: 'success', metadata, raw })).toBe(
        'test\nSteps: 20',
      );
    });

    it('should rebuild when the raw data holds no text', () => {
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 0,
        height: 0,
        sampling: { steps: 20 },
      };
      const raw: RawMetadata = { format: 'png', chunks: [] };

      expect(stringify({ status: 'success', metadata, raw })).toBe(
        'test\nSteps: 20',
      );
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

      expect(stringify(result)).toBe('test');
    });
  });

  describe('EmbedMetadata input', () => {
    it('should produce same output as buildEmbedText for EmbedMetadata', () => {
      const metadata: EmbedMetadata = {
        prompt: 'masterpiece, 1girl',
        negativePrompt: 'lowres',
        width: 512,
        height: 768,
        sampling: { steps: 20, sampler: 'Euler a', cfg: 7, seed: '12345' },
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

describe('stringify - vendor status', () => {
  const vendor = (info: Extract<ParseResult, { status: 'vendor' }>['info']) =>
    stringify({ status: 'vendor', info });

  it('joins the company name and the service name', () => {
    expect(
      vendor({
        vendor: 'openai',
        product: 'ChatGPT',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('OpenAI GPT Image');
    expect(vendor({ vendor: 'google', source: 'c2pa', media: 'image' })).toBe(
      'Google Gemini',
    );
  });

  it('shows only the declared product for an unknown vendor', () => {
    expect(
      vendor({
        vendor: 'unknown',
        product: 'Sora',
        source: 'c2pa',
        media: 'image',
      }),
    ).toBe('Sora');
  });

  it('names an unknown vendor without a product Unknown', () => {
    expect(vendor({ vendor: 'unknown', source: 'xmp', media: 'image' })).toBe(
      'Unknown',
    );
  });
});

describe('formatRaw / stringify - video raw metadata', () => {
  const raw = {
    format: 'mp4',
    tags: [
      { key: 'custom', value: 'first', source: 'mdta' },
      { key: '©cmt', value: 'second', source: 'itunes' },
    ],
  } as const;

  it('writes each video tag as key: value', () => {
    expect(formatRaw({ ...raw, tags: [...raw.tags] })).toBe(
      'custom: first\n\n©cmt: second',
    );
  });

  it('formats an unrecognized video result the same way', () => {
    expect(
      stringify({
        status: 'unrecognized',
        raw: { ...raw, tags: [...raw.tags] },
      }),
    ).toBe('custom: first\n\n©cmt: second');
  });

  it('names a video vendor with its video service', () => {
    expect(
      stringify({
        status: 'vendor',
        info: { vendor: 'google', source: 'c2pa', media: 'video' },
      }),
    ).toBe('Google Veo');
  });
});

describe('buildEmbedText - Denoising strength', () => {
  const base: EmbedMetadata = {
    prompt: 'a fox',
    negativePrompt: '',
    width: 512,
    height: 512,
  };

  it('writes a lowered main-pass strength', () => {
    const text = buildEmbedText({
      ...base,
      sampling: { steps: 20, denoise: 0.8 },
    });
    expect(text).toContain('Denoising strength: 0.8');
  });

  it('leaves out a main-pass strength of 1 (full denoising, the default)', () => {
    const text = buildEmbedText({
      ...base,
      sampling: { steps: 20, denoise: 1 },
    });
    expect(text).not.toContain('Denoising strength');
  });

  it('prefers the hires strength when both are present', () => {
    const text = buildEmbedText({
      ...base,
      sampling: { steps: 20, denoise: 0.8 },
      hires: { scale: 2, denoise: 0.3 },
    });
    expect(text).toContain('Denoising strength: 0.3');
    expect(text).not.toContain('Denoising strength: 0.8');
  });
});
