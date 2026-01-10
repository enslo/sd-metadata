import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata } from '../../../src/converters';
import { read } from '../../../src/index';

const SAMPLES_DIR = path.join(__dirname, '../../../samples');

describe('NovelAI metadata conversion', () => {
  describe('PNG → WebP conversion', () => {
    test('should convert novelai-full.png to WebP with nested JSON structure', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/novelai-full.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = read(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      expect(pngResult.metadata.software).toBe('novelai');

      // Convert to WebP format
      const conversionResult = convertMetadata(pngResult, 'webp');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('webp');
      if (conversionResult.value.format !== 'webp') return;

      // Should have segments
      expect(conversionResult.value.segments.length).toBeGreaterThan(0);

      // Should have exifUserComment
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();

      // The userComment should be valid JSON with nested structure
      if (userComment) {
        const parsed = JSON.parse(userComment.data);
        expect(parsed.Comment).toBeDefined();
        expect(parsed.Software).toBe('NovelAI');
      }
    });

    const additionalSamples = [
      'png/novelai-curated.png',
      'png/novelai-full-3char.png',
    ];

    test.each(additionalSamples)('should convert %s to WebP', (samplePath) => {
      const fullPath = path.join(SAMPLES_DIR, samplePath);
      const data = new Uint8Array(fs.readFileSync(fullPath));

      const result = read(data);
      expect(result.status).toBe('success');
      if (result.status !== 'success') return;

      const conversion = convertMetadata(result, 'webp');
      expect(conversion.ok).toBe(true);
      if (!conversion.ok) return;

      expect(conversion.value.format).toBe('webp');
      if (conversion.value.format !== 'webp') return;

      // Verify segments are not empty
      expect(conversion.value.segments.length).toBeGreaterThan(0);

      // Should have exifUserComment with valid JSON
      const userComment = conversion.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();
      if (userComment) {
        const parsed = JSON.parse(userComment.data);
        expect(parsed.Comment).toBeDefined();
        expect(parsed.Software).toBe('NovelAI');
      }
    });
  });

  describe('WebP → PNG conversion', () => {
    test('should convert novelai-full-3char.webp to PNG with all chunks', () => {
      const webpPath = path.join(SAMPLES_DIR, 'webp/novelai-full-3char.webp');
      const webpData = new Uint8Array(fs.readFileSync(webpPath));

      const webpResult = read(webpData);
      expect(webpResult.status).toBe('success');
      if (webpResult.status !== 'success') return;

      expect(webpResult.metadata.software).toBe('novelai');

      // Convert to PNG format
      const conversionResult = convertMetadata(webpResult, 'png');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('png');
      if (conversionResult.value.format !== 'png') return;

      // Should have chunks
      expect(conversionResult.value.chunks.length).toBeGreaterThan(0);

      // Should have expected NovelAI chunks
      const keywords = conversionResult.value.chunks.map((c) => c.keyword);
      expect(keywords).toContain('Title');
      expect(keywords).toContain('Software');
      expect(keywords).toContain('Comment');
    });

    test('should convert novelai-curated.webp to PNG', () => {
      const webpPath = path.join(SAMPLES_DIR, 'webp/novelai-curated.webp');
      const webpData = new Uint8Array(fs.readFileSync(webpPath));

      const result = read(webpData);
      expect(result.status).toBe('success');
      if (result.status !== 'success') return;

      const conversion = convertMetadata(result, 'png');
      expect(conversion.ok).toBe(true);
      if (!conversion.ok) return;

      expect(conversion.value.format).toBe('png');
      if (conversion.value.format !== 'png') return;

      // Verify chunks are not empty and contain expected keys
      expect(conversion.value.chunks.length).toBeGreaterThan(0);
      const keywords = conversion.value.chunks.map((c) => c.keyword);
      expect(keywords).toContain('Software');
      expect(keywords).toContain('Comment');
    });
  });

  describe('Round-trip conversion', () => {
    const roundTripSamples = [
      'png/novelai-full.png',
      'png/novelai-curated.png',
      'png/novelai-full-3char.png',
    ];

    test.each(roundTripSamples)(
      'should preserve Comment in round-trip for %s (PNG → WebP → PNG)',
      (samplePath) => {
        const fullPath = path.join(SAMPLES_DIR, samplePath);
        const data = new Uint8Array(fs.readFileSync(fullPath));

        const originalResult = read(data);
        expect(originalResult.status).toBe('success');
        if (originalResult.status !== 'success') return;

        const originalChunks =
          originalResult.raw.format === 'png' ? originalResult.raw.chunks : [];
        const originalComment = originalChunks.find(
          (c) => c.keyword === 'Comment',
        );

        // Convert to WebP
        const webpConversion = convertMetadata(originalResult, 'webp');
        expect(webpConversion.ok).toBe(true);
        if (!webpConversion.ok) return;

        // Create mock WebP ParseResult
        const mockWebpResult = {
          status: 'success' as const,
          metadata: originalResult.metadata,
          raw: webpConversion.value,
        };

        // Convert back to PNG
        const pngConversion = convertMetadata(mockWebpResult, 'png');
        expect(pngConversion.ok).toBe(true);
        if (!pngConversion.ok) return;
        if (pngConversion.value.format !== 'png') return;

        // Comment should be preserved
        const resultComment = pngConversion.value.chunks.find(
          (c) => c.keyword === 'Comment',
        );
        expect(resultComment).toBeDefined();
        if (originalComment && resultComment) {
          expect(resultComment.text).toBe(originalComment.text);
        }
      },
    );
  });

  describe('Error cases', () => {
    test('should return raw data as-is when formats match', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/novelai-full.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = read(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      // Convert PNG to PNG (should return as-is)
      const conversionResult = convertMetadata(pngResult, 'png');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value).toBe(pngResult.raw);
    });
  });
});
