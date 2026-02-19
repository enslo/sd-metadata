import { describe, expect, it } from 'vitest';
import { convertMetadata } from '../../../src/converters';
import type {
  GenerationMetadata,
  MetadataSegment,
  ParseResult,
  PngTextChunk,
} from '../../../src/types';

/**
 * Helper to create a successful ParseResult with mock data
 */
function createParseResult(
  software: GenerationMetadata['software'],
  format: 'png' | 'jpeg' | 'webp',
  data: { chunks?: PngTextChunk[]; segments?: MetadataSegment[] },
): ParseResult {
  const raw =
    format === 'png'
      ? { format, chunks: data.chunks || [] }
      : { format, segments: data.segments || [] };

  return {
    status: 'success',
    metadata: {
      software,
      prompt: 'test prompt',
      negativePrompt: '',
      width: 512,
      height: 512,
    } as GenerationMetadata,
    raw,
  };
}

describe('convertMetadata - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for empty status', () => {
      const parseResult: ParseResult = {
        status: 'empty',
      };

      const result = convertMetadata(parseResult, 'png');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('missingRawData');
      }
    });

    it('should return error for invalid status', () => {
      const parseResult: ParseResult = {
        status: 'invalid',
        message: 'test error',
      };

      const result = convertMetadata(parseResult, 'png');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidParseResult');
      }
    });

    // TODO: Future improvement - support raw metadata conversion for unrecognized formats
    // Even if we can't parse the metadata, we should be able to convert the raw chunks/segments
    // between formats (e.g., PNG chunks -> JPEG/WebP segments) without understanding the content.
    // This would enable format conversion even for unknown/future tools.
    it('should return error for unrecognized format without software', () => {
      const parseResult: ParseResult = {
        status: 'unrecognized',
        raw: {
          format: 'png',
          chunks: [{ type: 'tEXt', keyword: 'unknown', text: 'test' }],
        },
      };

      const result = convertMetadata(parseResult, 'jpeg');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedSoftware');
        if (result.error.type === 'unsupportedSoftware') {
          expect(result.error.software).toBe('unknown');
        }
      }
    });
  });

  describe('same format conversion (no-op)', () => {
    it('should return original PNG data for PNG → PNG', () => {
      const chunks: PngTextChunk[] = [
        { type: 'tEXt', keyword: 'parameters', text: 'test data' },
      ];
      const parseResult = createParseResult('sd-webui', 'png', {
        chunks,
      });

      const result = convertMetadata(parseResult, 'png');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('png');
        if (result.value.format === 'png') {
          expect(result.value.chunks).toEqual(chunks);
        }
      }
    });

    it('should return original JPEG data for JPEG → JPEG', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: 'test data' },
      ];
      const parseResult = createParseResult('sd-webui', 'jpeg', {
        segments,
      });

      const result = convertMetadata(parseResult, 'jpeg');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('jpeg');
        if (result.value.format !== 'png') {
          expect(result.value.segments).toEqual(segments);
        }
      }
    });

    it('should return original WebP data for WebP → WebP', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: 'test data' },
      ];
      const parseResult = createParseResult('sd-webui', 'webp', {
        segments,
      });

      const result = convertMetadata(parseResult, 'webp');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('webp');
        if (result.value.format !== 'png') {
          expect(result.value.segments).toEqual(segments);
        }
      }
    });
  });

  describe('format conversion', () => {
    it('should convert PNG → JPEG for A1111', () => {
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'parameters',
          text: 'test prompt\nSteps: 20, Size: 512x512',
        },
      ];
      const parseResult = createParseResult('sd-webui', 'png', {
        chunks,
      });

      const result = convertMetadata(parseResult, 'jpeg');

      expect(result.ok).toBe(true);
      if (result.ok && result.value.format !== 'png') {
        expect(result.value.format).toBe('jpeg');
        expect(result.value.segments).toHaveLength(1);
        expect(result.value.segments.at(0)?.source.type).toBe(
          'exifUserComment',
        );
        expect(result.value.segments.at(0)?.data).toBe(
          'test prompt\nSteps: 20, Size: 512x512',
        );
      }
    });

    it('should convert PNG → WebP for A1111', () => {
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'parameters',
          text: 'test prompt\nSteps: 20, Size: 512x512',
        },
      ];
      const parseResult = createParseResult('sd-webui', 'png', {
        chunks,
      });

      const result = convertMetadata(parseResult, 'webp');

      expect(result.ok).toBe(true);
      if (result.ok && result.value.format !== 'png') {
        expect(result.value.format).toBe('webp');
        expect(result.value.segments).toHaveLength(1);
        expect(result.value.segments.at(0)?.source.type).toBe(
          'exifUserComment',
        );
        expect(result.value.segments.at(0)?.data).toBe(
          'test prompt\nSteps: 20, Size: 512x512',
        );
      }
    });

    it('should convert JPEG → PNG for A1111', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: 'test prompt\nSteps: 20, Size: 512x512',
        },
      ];
      const parseResult = createParseResult('sd-webui', 'jpeg', {
        segments,
      });

      const result = convertMetadata(parseResult, 'png');

      expect(result.ok).toBe(true);
      if (result.ok && result.value.format === 'png') {
        expect(result.value.format).toBe('png');
        expect(result.value.chunks).toHaveLength(1);
        expect(result.value.chunks.at(0)?.type).toBe('tEXt');
        expect(result.value.chunks.at(0)?.keyword).toBe('parameters');
        expect(result.value.chunks.at(0)?.text).toBe(
          'test prompt\nSteps: 20, Size: 512x512',
        );
      }
    });

    it('should convert JPEG → WebP (segment copy)', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: 'test data' },
      ];
      const parseResult = createParseResult('sd-webui', 'jpeg', {
        segments,
      });

      const result = convertMetadata(parseResult, 'webp');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('webp');
        if (result.value.format !== 'png') {
          expect(result.value.segments).toEqual(segments);
        }
      }
    });
  });

  describe('software-specific conversion', () => {
    const testSoftware: Array<{
      software: GenerationMetadata['software'];
      keyword: string;
    }> = [
      { software: 'novelai', keyword: 'Comment' },
      { software: 'sd-webui', keyword: 'parameters' },
      { software: 'forge', keyword: 'parameters' },
      { software: 'forge-classic', keyword: 'parameters' },
      { software: 'forge-neo', keyword: 'parameters' },
      { software: 'reforge', keyword: 'parameters' },
      { software: 'easy-reforge', keyword: 'parameters' },
      { software: 'civitai', keyword: 'parameters' },
      { software: 'sd-next', keyword: 'parameters' },
      { software: 'ruined-fooocus', keyword: 'parameters' },
      { software: 'hf-space', keyword: 'parameters' },
      { software: 'comfyui', keyword: 'prompt' },
      { software: 'tensorart', keyword: 'prompt' },
      { software: 'stability-matrix', keyword: 'prompt' },
      { software: 'swarmui', keyword: 'parameters' },
      { software: 'invokeai', keyword: 'invokeai_metadata' },
    ];

    for (const { software, keyword } of testSoftware) {
      it(`should convert ${software} PNG → JPEG`, () => {
        const chunks: PngTextChunk[] = [
          { type: 'tEXt', keyword, text: 'test data' },
        ];
        const parseResult = createParseResult(software, 'png', {
          chunks,
        });

        const result = convertMetadata(parseResult, 'jpeg');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.format).toBe('jpeg');
        }
      });
    }
  });

  describe('edge cases', () => {
    it('should handle empty chunks', () => {
      const parseResult = createParseResult('sd-webui', 'png', {
        chunks: [],
      });

      const result = convertMetadata(parseResult, 'jpeg');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('jpeg');
      }
    });

    it('should handle empty segments', () => {
      const parseResult = createParseResult('sd-webui', 'jpeg', {
        segments: [],
      });

      const result = convertMetadata(parseResult, 'png');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.format).toBe('png');
      }
    });

    it('should handle all supported target formats', () => {
      const chunks: PngTextChunk[] = [
        { type: 'tEXt', keyword: 'parameters', text: 'test' },
      ];
      const parseResult = createParseResult('sd-webui', 'png', {
        chunks,
      });

      const formats: Array<'png' | 'jpeg' | 'webp'> = ['png', 'jpeg', 'webp'];
      for (const format of formats) {
        const result = convertMetadata(parseResult, format);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.format).toBe(format);
        }
      }
    });
  });
});
