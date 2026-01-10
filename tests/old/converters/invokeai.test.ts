import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata } from '../../../src/converters';
import { read } from '../../../src/index';

const SAMPLES_DIR = path.join(__dirname, '../../../samples');

describe('InvokeAI metadata conversion', () => {
  describe('PNG → JPEG/WebP conversion', () => {
    test('should convert invokeai.png to WebP with iTXt chunks', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/invokeai.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = read(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      expect(pngResult.metadata.software).toBe('invokeai');

      // Convert to WebP format
      const conversionResult = convertMetadata(pngResult, 'webp');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('webp');
      if (conversionResult.value.format !== 'webp') return;

      // Should have exifUserComment
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();

      // Should be valid JSON with InvokeAI chunks
      if (userComment) {
        const parsed = JSON.parse(userComment.data);
        expect(parsed.invokeai_metadata).toBeDefined();
        expect(parsed.invokeai_graph).toBeDefined();
      }
    });
  });

  describe('Round-trip conversion', () => {
    test('should preserve both iTXt chunks in round-trip (PNG → WebP → PNG)', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/invokeai.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      // Parse original PNG
      const originalResult = read(pngData);
      expect(originalResult.status).toBe('success');
      if (originalResult.status !== 'success') return;

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

      // Should have both chunks
      const keywords = pngConversion.value.chunks.map((c) => c.keyword);
      expect(keywords).toContain('invokeai_metadata');
      expect(keywords).toContain('invokeai_graph');

      // Chunks should be iTXt type
      const metadataChunk = pngConversion.value.chunks.find(
        (c) => c.keyword === 'invokeai_metadata',
      );
      expect(metadataChunk?.type).toBe('iTXt');
    });
  });
});
