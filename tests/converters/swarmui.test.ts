import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata, parseJpeg, parsePng, parseWebp } from '../../src';

const SAMPLES_DIR = path.join(__dirname, '../../samples');

describe('SwarmUI metadata conversion', () => {
  describe('PNG → JPEG/WebP conversion', () => {
    test('should convert SwarmUI PNG to JPEG format', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/swarmui.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      expect(pngResult.metadata.software).toBe('swarmui');

      // Convert to JPEG format
      const conversionResult = convertMetadata(pngResult, 'jpeg');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('jpeg');
      if (conversionResult.value.format !== 'jpeg') return;

      // Should have exifUserComment
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();

      // Should be valid JSON containing both chunks
      if (userComment) {
        const parsed = JSON.parse(userComment.data);
        expect(parsed.prompt).toBeDefined();
        expect(parsed.parameters).toBeDefined();
      }
    });
  });

  describe('JPEG/WebP → PNG conversion', () => {
    test('should convert SwarmUI JPEG to PNG format', () => {
      const jpegPath = path.join(SAMPLES_DIR, 'jpg/swarmui.jpg');
      const jpegData = new Uint8Array(fs.readFileSync(jpegPath));

      const jpegResult = parseJpeg(jpegData);
      expect(jpegResult.status).toBe('success');
      if (jpegResult.status !== 'success') return;

      expect(jpegResult.metadata.software).toBe('swarmui');

      // Convert to PNG format
      const conversionResult = convertMetadata(jpegResult, 'png');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('png');
      if (conversionResult.value.format !== 'png') return;

      // Should have parameters chunk at minimum
      const parameters = conversionResult.value.chunks.find(
        (c) => c.keyword === 'parameters',
      );
      expect(parameters).toBeDefined();
    });
  });

  describe('Round-trip conversion', () => {
    test('PNG → JPEG → PNG should preserve both chunks', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/swarmui.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      // Parse original PNG
      const originalResult = parsePng(pngData);
      expect(originalResult.status).toBe('success');
      if (originalResult.status !== 'success') return;

      // Convert to JPEG
      const jpegConversion = convertMetadata(originalResult, 'jpeg');
      expect(jpegConversion.ok).toBe(true);
      if (!jpegConversion.ok) return;

      // Create mock JPEG ParseResult
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

      // Should have both prompt and parameters chunks
      const keywords = pngConversion.value.chunks.map((c) => c.keyword);
      expect(keywords).toContain('prompt');
      expect(keywords).toContain('parameters');
    });
  });
});
