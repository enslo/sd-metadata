import { describe, expect, it } from 'vitest';
import {
  convertSwarmUIPngToSegments,
  convertSwarmUISegmentsToPng,
} from '../../../src/converters/swarmui';
import type { MetadataSegment, PngTextChunk } from '../../../src/types';

describe('SwarmUI converter', () => {
  describe('workflow preservation', () => {
    it('should preserve node graph (prompt chunk) in PNG→JPEG conversion', () => {
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'parameters',
          text: '{"sui_image_params": {"prompt": "test", "seed": 123}}',
        },
        {
          type: 'tEXt',
          keyword: 'prompt',
          text: '{"1": {"class_type": "KSampler", "inputs": {}}}',
        },
      ];

      const segments = convertSwarmUIPngToSegments(chunks);

      // Should have 2 segments: UserComment + Make
      expect(segments).toHaveLength(2);
      expect(segments.some((s) => s.source.type === 'exifUserComment')).toBe(
        true,
      );
      expect(segments.some((s) => s.source.type === 'exifMake')).toBe(true);

      // Verify content
      const userComment = segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      const make = segments.find((s) => s.source.type === 'exifMake');

      expect(userComment?.data).toContain('sui_image_params');
      expect(make?.data).toContain('KSampler');
    });

    it('should handle PNG without workflow (only parameters)', () => {
      const chunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'parameters',
          text: '{"sui_image_params": {"prompt": "test"}}',
        },
      ];

      const segments = convertSwarmUIPngToSegments(chunks);

      // Should only have UserComment (no Make)
      expect(segments).toHaveLength(1);
      expect(segments[0]?.source.type).toBe('exifUserComment');
    });

    it('should restore both chunks from extended format', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: '{"sui_image_params": {"prompt": "test"}}',
        },
        {
          source: { type: 'exifMake' },
          data: '{"1": {"class_type": "KSampler"}}',
        },
      ];

      const chunks = convertSwarmUISegmentsToPng(segments);

      // Should restore both chunks
      expect(chunks.some((c) => c.keyword === 'parameters')).toBe(true);
      expect(chunks.some((c) => c.keyword === 'prompt')).toBe(true);

      // Verify content
      const parametersChunk = chunks.find((c) => c.keyword === 'parameters');
      const promptChunk = chunks.find((c) => c.keyword === 'prompt');

      expect(parametersChunk?.text).toContain('sui_image_params');
      expect(promptChunk?.text).toContain('KSampler');
    });

    it('should handle native SwarmUI JPEG/WebP (no workflow)', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifUserComment' },
          data: '{"sui_image_params": {"prompt": "test"}}',
        },
      ];

      const chunks = convertSwarmUISegmentsToPng(segments);

      // Should only have parameters chunk (no prompt)
      expect(chunks.some((c) => c.keyword === 'parameters')).toBe(true);
      expect(chunks.some((c) => c.keyword === 'prompt')).toBe(false);
    });

    it('should round-trip correctly (PNG → segments → PNG)', () => {
      const originalChunks: PngTextChunk[] = [
        {
          type: 'tEXt',
          keyword: 'parameters',
          text: '{"sui_image_params": {"prompt": "test", "seed": 123}}',
        },
        {
          type: 'tEXt',
          keyword: 'prompt',
          text: '{"1": {"class_type": "KSampler"}}',
        },
      ];

      // Convert to segments
      const segments = convertSwarmUIPngToSegments(originalChunks);

      // Convert back to chunks
      const restoredChunks = convertSwarmUISegmentsToPng(segments);

      // Should match original structure
      expect(restoredChunks).toHaveLength(2);
      expect(restoredChunks.some((c) => c.keyword === 'parameters')).toBe(true);
      expect(restoredChunks.some((c) => c.keyword === 'prompt')).toBe(true);
    });
  });
});
