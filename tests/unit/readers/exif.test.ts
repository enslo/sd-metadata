import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExifMetadataSegments } from '../../../src/readers/exif';
import { readWebpMetadata } from '../../../src/readers/webp';
import type { MetadataSegment } from '../../../src/types';
import { buildExifTiffData } from '../../../src/writers/exif';

describe('Exif Reader/Writer - Unit Tests', () => {
  describe('Software and DocumentName support', () => {
    it('should round-trip Software tag', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifSoftware' },
          data: 'NovelAI Diffusion V4.5',
        },
      ];

      const exifData = buildExifTiffData(segments);
      const result = parseExifMetadataSegments(exifData);

      expect(result).toHaveLength(1);
      expect(result[0]?.source.type).toBe('exifSoftware');
      expect(result[0]?.data).toBe('NovelAI Diffusion V4.5');
    });

    it('should round-trip DocumentName tag', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifDocumentName' },
          data: 'NovelAI generated image',
        },
      ];

      const exifData = buildExifTiffData(segments);
      const result = parseExifMetadataSegments(exifData);

      expect(result).toHaveLength(1);
      expect(result[0]?.source.type).toBe('exifDocumentName');
      expect(result[0]?.data).toBe('NovelAI generated image');
    });

    it('should handle multiple tags simultaneously', () => {
      const segments: MetadataSegment[] = [
        {
          source: { type: 'exifSoftware' },
          data: 'Test Software',
        },
        {
          source: { type: 'exifDocumentName' },
          data: 'Test Doc',
        },
        {
          source: { type: 'exifImageDescription' },
          data: 'Test Desc',
        },
        {
          source: { type: 'exifMake' },
          data: 'Test Make',
        },
      ];

      const exifData = buildExifTiffData(segments);
      const result = parseExifMetadataSegments(exifData);

      expect(result).toHaveLength(4);

      const software = result.find((s) => s.source.type === 'exifSoftware');
      expect(software?.data).toBe('Test Software');

      const docName = result.find((s) => s.source.type === 'exifDocumentName');
      expect(docName?.data).toBe('Test Doc');

      const desc = result.find((s) => s.source.type === 'exifImageDescription');
      expect(desc?.data).toBe('Test Desc');

      const make = result.find((s) => s.source.type === 'exifMake');
      expect(make?.data).toBe('Test Make');
    });
  });

  describe('Integration with Real Samples', () => {
    it('should preserve NovelAI tags in round-trip', () => {
      const samplePath = join(
        process.cwd(),
        'samples/webp/novelai-full-3char.webp',
      );
      const fileData = new Uint8Array(readFileSync(samplePath));

      // Read original
      const readResult = readWebpMetadata(fileData);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      const segments = readResult.value;
      const hasSoftware = segments.some(
        (s) => s.source.type === 'exifSoftware',
      );
      const hasDocName = segments.some(
        (s) => s.source.type === 'exifDocumentName',
      );

      expect(hasSoftware).toBe(true);
      expect(hasDocName).toBe(true);

      // Write back (using low-level buildExifTiffData for verify)
      const newExifData = buildExifTiffData(segments);

      // Parse back the generated Exif data
      const roundTripResult = parseExifMetadataSegments(newExifData);

      const rtSoftware = roundTripResult.find(
        (s) => s.source.type === 'exifSoftware',
      );
      const rtDocName = roundTripResult.find(
        (s) => s.source.type === 'exifDocumentName',
      );

      expect(rtSoftware).toBeDefined();
      expect(rtSoftware?.data).toContain('NovelAI');

      expect(rtDocName).toBeDefined();
      expect(rtDocName?.data).toContain('NovelAI');
    });
  });
});
