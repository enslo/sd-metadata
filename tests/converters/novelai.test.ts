import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata, parsePng, parseWebp } from '../../src';

const SAMPLES_DIR = path.join(__dirname, '../../samples');

describe('NovelAI metadata conversion', () => {
  describe('PNG → WebP conversion', () => {
    test('should convert NovelAI PNG to WebP format', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/novelai-full.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
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
  });

  describe('WebP → PNG conversion', () => {
    test('should convert NovelAI WebP to PNG format', () => {
      const webpPath = path.join(SAMPLES_DIR, 'webp/novelai-full-3char.webp');
      const webpData = new Uint8Array(fs.readFileSync(webpPath));

      const webpResult = parseWebp(webpData);
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
  });

  describe('Round-trip conversion', () => {
    test('PNG → WebP → PNG should preserve essential data', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/novelai-full.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      // Parse original PNG
      const originalResult = parsePng(pngData);
      expect(originalResult.status).toBe('success');
      if (originalResult.status !== 'success') return;

      // Convert to WebP
      const webpConversion = convertMetadata(originalResult, 'webp');
      expect(webpConversion.ok).toBe(true);
      if (!webpConversion.ok) return;

      // Create a mock WebP ParseResult for back-conversion
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

      // Check that essential chunks are preserved
      const resultChunks = pngConversion.value.chunks;
      const originalChunks =
        originalResult.raw.format === 'png' ? originalResult.raw.chunks : [];

      // Comment chunk should match
      const originalComment = originalChunks.find(
        (c) => c.keyword === 'Comment',
      );
      const resultComment = resultChunks.find((c) => c.keyword === 'Comment');

      expect(resultComment).toBeDefined();
      if (originalComment && resultComment) {
        expect(resultComment.text).toBe(originalComment.text);
      }
    });
  });

  describe('Error cases', () => {
    test('should return error for unsupported software', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/invokeai.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      // InvokeAI is not supported yet
      const conversionResult = convertMetadata(pngResult, 'webp');
      expect(conversionResult.ok).toBe(false);
      if (conversionResult.ok) return;

      expect(conversionResult.error.type).toBe('unsupportedSoftware');
    });

    test('should return as-is when source and target format match', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/novelai-full.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
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
