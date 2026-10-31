import { describe, expect, it } from 'vitest';
import {
  convertFooocusPngToSegments,
  convertFooocusSegmentsToPng,
} from '../../../src/converters/fooocus';
import type { MetadataSegment, PngTextChunk } from '../../../src/types';

const JSON_TEXT =
  '{"prompt": "1girl, #\\u30c6\\u30b9\\u30c8", "base_model": "model.safetensors", "seed": "7100816951239959675"}';
const A1111_TEXT =
  'masterpiece, #テスト\nNegative prompt: lowres\nSteps: 30, Sampler: DPM++ 2M SDE Karras, Seed: 4575475577937763433, Version: Fooocus v2.5.5';

describe('Fooocus converter', () => {
  describe('PNG → segments', () => {
    it('should carry parameters to UserComment and drop fooocus_scheme', () => {
      const chunks: PngTextChunk[] = [
        { type: 'tEXt', keyword: 'parameters', text: JSON_TEXT },
        { type: 'tEXt', keyword: 'fooocus_scheme', text: 'fooocus' },
      ];

      const segments = convertFooocusPngToSegments(chunks);

      expect(segments).toEqual([
        { source: { type: 'exifUserComment' }, data: JSON_TEXT },
      ]);
    });

    it('should return no segments without a parameters chunk', () => {
      const chunks: PngTextChunk[] = [
        { type: 'tEXt', keyword: 'fooocus_scheme', text: 'fooocus' },
      ];

      expect(convertFooocusPngToSegments(chunks)).toEqual([]);
    });
  });

  describe('segments → PNG', () => {
    it('should restore fooocus_scheme=fooocus for JSON content as tEXt', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: JSON_TEXT },
      ];

      const chunks = convertFooocusSegmentsToPng(segments);

      expect(chunks).toEqual([
        { type: 'tEXt', keyword: 'parameters', text: JSON_TEXT },
        { type: 'tEXt', keyword: 'fooocus_scheme', text: 'fooocus' },
      ]);
    });

    it('should escape raw non-ASCII inside JSON to keep the tEXt chunk Latin-1', () => {
      const rawJson = '{"prompt": "テスト"}';
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: rawJson },
      ];

      const chunks = convertFooocusSegmentsToPng(segments);

      expect(chunks[0]).toEqual({
        type: 'tEXt',
        keyword: 'parameters',
        text: '{"prompt": "\\u30c6\\u30b9\\u30c8"}',
      });
      expect(chunks[1]?.text).toBe('fooocus');
    });

    it('should restore fooocus_scheme=a1111 for text content as iTXt when non-Latin-1', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: A1111_TEXT },
      ];

      const chunks = convertFooocusSegmentsToPng(segments);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.type).toBe('iTXt');
      expect(chunks[0]?.keyword).toBe('parameters');
      // A1111 text must not be Unicode-escaped: the escape would become literal text
      expect(chunks[0]?.text).toBe(A1111_TEXT);
      expect(chunks[1]).toEqual({
        type: 'tEXt',
        keyword: 'fooocus_scheme',
        text: 'a1111',
      });
    });

    it('should use tEXt for ASCII-only A1111 text', () => {
      const ascii = 'a cat\nSteps: 30, Seed: 12345, Version: Fooocus v2.5.5';
      const segments: MetadataSegment[] = [
        { source: { type: 'exifUserComment' }, data: ascii },
      ];

      const chunks = convertFooocusSegmentsToPng(segments);

      expect(chunks[0]).toEqual({
        type: 'tEXt',
        keyword: 'parameters',
        text: ascii,
      });
      expect(chunks[1]?.text).toBe('a1111');
    });

    it('should return no chunks without a UserComment segment', () => {
      const segments: MetadataSegment[] = [
        { source: { type: 'exifMake' }, data: 'something' },
      ];

      expect(convertFooocusSegmentsToPng(segments)).toEqual([]);
    });
  });
});
