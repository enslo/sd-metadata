import { describe, expect, it } from 'vitest';
import {
  convertStabilityMatrixPngToSegments,
  convertStabilityMatrixSegmentsToPng,
} from '../../../src/converters/stability-matrix';
import type { MetadataSegment, PngTextChunk } from '../../../src/types';

/** iTXt chunk as Stability Matrix >= 2.16.0 writes it (uncompressed, no tags) */
function itxt(keyword: string, text: string): PngTextChunk {
  return {
    type: 'iTXt',
    keyword,
    compressionFlag: 0,
    compressionMethod: 0,
    languageTag: '',
    translatedKeyword: '',
    text,
  };
}

// ComfyUI writes the graph itself: compact ASCII JSON with Unicode escapes
const GRAPH_TEXT =
  '{"1":{"class_type":"CLIPTextEncode","inputs":{"text":"1girl, #\\u30c6\\u30b9\\u30c8"}}}';
const PARAMETERS_TEXT =
  '1girl, #テスト\nNegative prompt: lowres\nSteps: 20, Sampler: Euler Ancestral Karras, CFG scale: 5, Seed: 395309383, Size: 1024x1024, Model hash: F116B0C7, Model: model.safetensors';
const PARAMETERS_JSON = {
  PositivePrompt: '1girl, #テスト',
  NegativePrompt: 'lowres',
  Steps: 20,
  Seed: 395309383,
};
const SMPROJ = {
  Version: 2,
  ProjectType: 'TextToImage',
  State: { Prompt: '1girl, #テスト' },
};

function toSegments(data: Record<string, unknown>): MetadataSegment[] {
  return [{ source: { type: 'exifUserComment' }, data: JSON.stringify(data) }];
}

describe('Stability Matrix converter', () => {
  describe('PNG → segments', () => {
    it('should merge all chunks into one UserComment JSON object', () => {
      const chunks: PngTextChunk[] = [
        { type: 'tEXt', keyword: 'prompt', text: GRAPH_TEXT },
        itxt('parameters', PARAMETERS_TEXT),
        itxt('parameters-json', JSON.stringify(PARAMETERS_JSON)),
        itxt('smproj', JSON.stringify(SMPROJ)),
      ];

      const segments = convertStabilityMatrixPngToSegments(chunks);

      expect(segments).toHaveLength(1);
      expect(segments[0]?.source).toEqual({ type: 'exifUserComment' });
      expect(JSON.parse(segments[0]?.data ?? '')).toEqual({
        prompt: JSON.parse(GRAPH_TEXT),
        parameters: PARAMETERS_TEXT,
        'parameters-json': PARAMETERS_JSON,
        smproj: SMPROJ,
      });
    });
  });

  describe('segments → PNG', () => {
    it('should write iTXt for non-Latin-1 text like Stability Matrix >= 2.16.0', () => {
      const chunks = convertStabilityMatrixSegmentsToPng(
        toSegments({
          prompt: JSON.parse(GRAPH_TEXT),
          parameters: PARAMETERS_TEXT,
          'parameters-json': PARAMETERS_JSON,
          smproj: SMPROJ,
        }),
      );

      expect(chunks).toEqual([
        // The ComfyUI graph keeps its escaped ASCII form in a tEXt chunk
        { type: 'tEXt', keyword: 'prompt', text: GRAPH_TEXT },
        itxt('parameters', PARAMETERS_TEXT),
        itxt('parameters-json', JSON.stringify(PARAMETERS_JSON)),
        itxt('smproj', JSON.stringify(SMPROJ)),
      ]);
    });

    it('should write tEXt when the text stays within Latin-1', () => {
      const ascii =
        'a cat\nNegative prompt: lowres\nSteps: 20, Seed: 1, Size: 512x512, Model hash: 00, Model: m';

      const chunks = convertStabilityMatrixSegmentsToPng(
        toSegments({
          parameters: ascii,
          'parameters-json': { PositivePrompt: 'a cat' },
        }),
      );

      expect(chunks).toEqual([
        { type: 'tEXt', keyword: 'parameters', text: ascii },
        {
          type: 'tEXt',
          keyword: 'parameters-json',
          text: '{"PositivePrompt":"a cat"}',
        },
      ]);
    });

    it('should round-trip the >= 2.16.0 chunk layout unchanged', () => {
      const original: PngTextChunk[] = [
        { type: 'tEXt', keyword: 'prompt', text: GRAPH_TEXT },
        itxt('parameters', PARAMETERS_TEXT),
        itxt('parameters-json', JSON.stringify(PARAMETERS_JSON)),
        itxt('smproj', JSON.stringify(SMPROJ)),
      ];

      const restored = convertStabilityMatrixSegmentsToPng(
        convertStabilityMatrixPngToSegments(original),
      );

      expect(restored).toEqual(original);
    });

    it('should return no chunks without a UserComment segment', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifMake' }, data: 'something' },
      ];

      expect(convertStabilityMatrixSegmentsToPng(segments)).toEqual([]);
    });
  });
});
