import { describe, expect, it } from 'vitest';
import { convertMetadata } from '../../../src/converters';
import {
  convertCivitaiPngToSegments,
  convertCivitaiSegmentsToPng,
} from '../../../src/converters/civitai';
import type {
  MetadataSegment,
  ParseResult,
  RawMetadata,
} from '../../../src/types';

const A1111_TEXT =
  '1girl, #テスト\nNegative prompt: lowres\nSteps: 20, Sampler: Euler a, Seed: 1070944611, Civitai resources: [{"type":"checkpoint","modelVersionId":3284240}]';
const ORCHESTRATION_JSON =
  '{"resource-stack":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"urn:air:sdxl:checkpoint:civitai:2904237@3284240"}},"extraMetadata":"{\\"prompt\\":\\"1girl\\"}"}';

const userComment = (data: string): MetadataSegment => ({
  source: { type: 'exifUserComment' },
  data,
});

function parseResultFor(raw: RawMetadata): ParseResult {
  return {
    status: 'success',
    metadata: {
      software: 'civitai',
      prompt: '',
      negativePrompt: '',
      width: 0,
      height: 0,
    },
    raw,
  };
}

describe('CivitAI converter', () => {
  describe('segments → PNG', () => {
    it('should move the EXIF segments into an eXIf chunk, not text chunks', () => {
      expect(convertCivitaiSegmentsToPng([userComment(A1111_TEXT)])).toEqual({
        chunks: [],
        exif: [userComment(A1111_TEXT)],
      });
      expect(
        convertCivitaiSegmentsToPng([userComment(ORCHESTRATION_JSON)]),
      ).toEqual({ chunks: [], exif: [userComment(ORCHESTRATION_JSON)] });
    });

    it('should drop segments that have no place in an eXIf chunk', () => {
      const result = convertCivitaiSegmentsToPng([
        userComment(A1111_TEXT),
        { source: { type: 'jpegCom' }, data: 'comment' },
      ]);

      expect(result.exif).toEqual([userComment(A1111_TEXT)]);
    });
  });

  describe('PNG → segments', () => {
    it('should carry the eXIf segments of a CivitAI PNG over unchanged', () => {
      const result = convertMetadata(
        parseResultFor({
          format: 'png',
          chunks: [],
          exif: [userComment(ORCHESTRATION_JSON)],
        }),
        'jpeg',
      );

      expect(result.ok).toBe(true);
      if (result.ok && result.value.format === 'jpeg') {
        expect(result.value.segments).toEqual([
          userComment(ORCHESTRATION_JSON),
        ]);
      }
    });

    it('should still convert text chunks written by earlier versions', () => {
      // A1111 text in a parameters chunk
      expect(
        convertCivitaiPngToSegments([
          { type: 'tEXt', keyword: 'parameters', text: A1111_TEXT },
        ]),
      ).toEqual([userComment(A1111_TEXT)]);

      // Orchestration JSON in a prompt chunk, expanded to top-level keys
      const segments = convertCivitaiPngToSegments([
        { type: 'tEXt', keyword: 'prompt', text: ORCHESTRATION_JSON },
      ]);
      expect(segments).toHaveLength(1);
      expect(JSON.parse(segments[0]?.data ?? '')).toEqual(
        JSON.parse(ORCHESTRATION_JSON),
      );
    });
  });

  describe('through convertMetadata', () => {
    it('should bring a CivitAI JPEG back as an eXIf PNG', () => {
      const result = convertMetadata(
        parseResultFor({ format: 'jpeg', segments: [userComment(A1111_TEXT)] }),
        'png',
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          format: 'png',
          chunks: [],
          exif: [userComment(A1111_TEXT)],
        });
      }
    });
  });
});
