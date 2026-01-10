import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata } from '../../src/converters';
import { read } from '../../src/index';

const SAMPLES_DIR = path.join(__dirname, '../../samples');

describe('Ruined Fooocus metadata conversion', () => {
  describe('PNG → JPEG conversion', () => {
    test('should convert ruined-fooocus.png to JPEG with JSON metadata', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/ruined-fooocus.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = read(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      expect(pngResult.metadata.software).toBe('ruined-fooocus');

      // Convert to JPEG format
      const conversionResult = convertMetadata(pngResult, 'jpeg');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('jpeg');
      if (conversionResult.value.format !== 'jpeg') return;

      // Should have exifUserComment segment
      expect(conversionResult.value.segments.length).toBeGreaterThan(0);
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();

      // Content should be JSON with Ruined Fooocus format
      if (userComment) {
        const parsed = JSON.parse(userComment.data);
        expect(parsed.Prompt).toBeDefined();
        expect(parsed.software).toBe('RuinedFooocus');
      }
    });
  });

  describe('Round-trip conversion', () => {
    test('should preserve JSON metadata in round-trip (PNG → JPEG → PNG)', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/ruined-fooocus.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      // Parse original PNG
      const originalResult = read(pngData);
      expect(originalResult.status).toBe('success');
      if (originalResult.status !== 'success') return;

      const originalChunks =
        originalResult.raw.format === 'png' ? originalResult.raw.chunks : [];
      const originalParams = originalChunks.find(
        (c) => c.keyword === 'parameters',
      );

      // Convert to JPEG
      const jpegConversion = convertMetadata(originalResult, 'jpeg');
      expect(jpegConversion.ok).toBe(true);
      if (!jpegConversion.ok) return;

      // Create mock JPEG ParseResult for back-conversion
      const mockJpegResult = {
        status: 'success' as const,
        metadata: originalResult.metadata,
        raw: jpegConversion.value,
      };

      // Convert back to PNG
      const pngConversion = convertMetadata(mockJpegResult, 'png');
      expect(pngConversion.ok).toBe(true);
      if (!pngConversion.ok) return;
      if (pngConversion.value.format !== 'png') return;

      // Check that parameters chunk is preserved
      const resultParams = pngConversion.value.chunks.find(
        (c) => c.keyword === 'parameters',
      );

      expect(resultParams).toBeDefined();
      if (originalParams && resultParams) {
        // JSON content should match
        const originalJson = JSON.parse(originalParams.text);
        const resultJson = JSON.parse(resultParams.text);
        expect(resultJson.Prompt).toBe(originalJson.Prompt);
        expect(resultJson.software).toBe('RuinedFooocus');
      }
    });
  });
});
