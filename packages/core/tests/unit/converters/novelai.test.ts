import { describe, expect, it } from 'vitest';
import {
  convertNovelaiPngToSegments,
  convertNovelaiSegmentsToPng,
} from '../../../src/converters/novelai';
import type { MetadataSegment, PngTextChunk } from '../../../src/types';

/**
 * PNG chunks as NovelAI writes them, with the given generation time key
 */
function novelaiChunks(timeKey: string): PngTextChunk[] {
  return [
    { type: 'tEXt', keyword: 'Title', text: 'NovelAI generated image' },
    { type: 'tEXt', keyword: 'Description', text: '1girl' },
    { type: 'tEXt', keyword: 'Software', text: 'NovelAI' },
    { type: 'tEXt', keyword: 'Source', text: 'NovelAI Diffusion V5 70AB5786' },
    { type: 'tEXt', keyword: timeKey, text: '1.5' },
    { type: 'tEXt', keyword: 'Comment', text: '{"prompt": "1girl"}' },
  ];
}

/**
 * WebP segments as NovelAI writes them, with the given generation time key
 */
function novelaiSegments(timeKey: string): MetadataSegment[] {
  return [
    { source: { type: 'exifImageDescription' }, data: '1girl' },
    {
      source: { type: 'exifUserComment' },
      data: JSON.stringify({
        Comment: '{"prompt": "1girl"}',
        Description: '1girl',
        [timeKey]: '1.5',
        Software: 'NovelAI',
        Source: 'NovelAI Diffusion V5 70AB5786',
        Title: 'NovelAI generated image',
      }),
    },
  ];
}

describe('NovelAI converter', () => {
  describe('PNG to segments', () => {
    it('should prefix the ImageDescription with NUL bytes for V4 and later', () => {
      const segments = convertNovelaiPngToSegments(
        novelaiChunks('Generation time'),
      );

      expect(segments[0]).toEqual({
        source: { type: 'exifImageDescription' },
        // \x00 rather than \0: "\01" would be read as one octal escape
        data: '\x00\x00\x00\x001girl',
      });
      const json = JSON.parse(segments[1]?.data ?? '');
      expect(Object.keys(json)).toEqual([
        'Comment',
        'Description',
        'Generation time',
        'Software',
        'Source',
        'Title',
      ]);
    });

    it('should keep the V3 layout: Generation_time and no NUL prefix', () => {
      const segments = convertNovelaiPngToSegments(
        novelaiChunks('Generation_time'),
      );

      expect(segments[0]).toEqual({
        source: { type: 'exifImageDescription' },
        data: '1girl',
      });
      const json = JSON.parse(segments[1]?.data ?? '');
      expect(Object.keys(json)).toEqual([
        'Comment',
        'Description',
        'Generation_time',
        'Software',
        'Source',
        'Title',
      ]);
      expect(json.Generation_time).toBe('1.5');
    });
  });

  describe('segments to PNG', () => {
    for (const timeKey of ['Generation time', 'Generation_time']) {
      it(`should restore the chunks under "${timeKey}"`, () => {
        const chunks = convertNovelaiSegmentsToPng(novelaiSegments(timeKey));

        expect(chunks.map((c) => c.keyword)).toEqual([
          'Title',
          'Description',
          'Software',
          'Source',
          timeKey,
          'Comment',
        ]);
        expect(chunks.find((c) => c.keyword === timeKey)?.text).toBe('1.5');
      });
    }
  });
});
