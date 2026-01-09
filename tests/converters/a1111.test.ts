import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata, parseJpeg, parsePng } from '../../src';

const SAMPLES_DIR = path.join(__dirname, '../../samples');

describe('A1111-format metadata conversion', () => {
  describe('PNG → JPEG/WebP conversion', () => {
    test('should convert forge-neo PNG to JPEG format', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/forge-neo.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      expect(pngResult.metadata.software).toBe('forge-neo');

      // Convert to JPEG format
      const conversionResult = convertMetadata(pngResult, 'jpeg');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('jpeg');
      if (conversionResult.value.format !== 'jpeg') return;

      // Should have exifUserComment segment
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();

      // Content should be plain text (starts with prompt)
      if (userComment) {
        expect(userComment.data).toContain('masterpiece');
      }
    });

    test('should convert civitai PNG to WebP format', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/civitai.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      // Civitai may be detected as sd-webui
      expect(['sd-webui', 'civitai']).toContain(pngResult.metadata.software);

      // Convert to WebP format
      const conversionResult = convertMetadata(pngResult, 'webp');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('webp');
      if (conversionResult.value.format !== 'webp') return;

      // Should have exifUserComment with A1111 format
      expect(conversionResult.value.segments.length).toBeGreaterThan(0);
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();
      expect(userComment?.data).toMatch(/Steps:/);
    });

    test('should convert forge-neo-hires.png with A1111 format', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/forge-neo-hires.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      expect(pngResult.metadata.software).toBe('forge-neo');

      const conversionResult = convertMetadata(pngResult, 'jpeg');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('jpeg');
      if (conversionResult.value.format !== 'jpeg') return;

      // Verify A1111 format
      expect(conversionResult.value.segments.length).toBeGreaterThan(0);
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();
      expect(userComment?.data).toMatch(/Steps:/);
    });
  });

  describe('JPEG/WebP → PNG conversion', () => {
    test('should convert forge-neo JPEG to PNG with parameters chunk', () => {
      const jpegPath = path.join(SAMPLES_DIR, 'jpg/forge-neo.jpeg');
      const jpegData = new Uint8Array(fs.readFileSync(jpegPath));

      const jpegResult = parseJpeg(jpegData);
      expect(jpegResult.status).toBe('success');
      if (jpegResult.status !== 'success') return;

      expect(jpegResult.metadata.software).toBe('forge-neo');

      // Convert to PNG format
      const conversionResult = convertMetadata(jpegResult, 'png');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('png');
      if (conversionResult.value.format !== 'png') return;

      // Should have parameters chunk with A1111 format
      expect(conversionResult.value.chunks.length).toBeGreaterThan(0);
      const parameters = conversionResult.value.chunks.find(
        (c) => c.keyword === 'parameters',
      );
      expect(parameters).toBeDefined();
      expect(parameters?.text).toMatch(/Steps:/);
      expect(parameters?.text).toContain('masterpiece');
    });

    test('should convert civitai.jpeg to PNG with A1111 format', () => {
      const jpegPath = path.join(SAMPLES_DIR, 'jpg/civitai.jpeg');
      const jpegData = new Uint8Array(fs.readFileSync(jpegPath));

      const jpegResult = parseJpeg(jpegData);
      expect(jpegResult.status).toBe('success');
      if (jpegResult.status !== 'success') return;

      expect(['sd-webui', 'civitai']).toContain(jpegResult.metadata.software);

      const conversionResult = convertMetadata(jpegResult, 'png');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('png');
      if (conversionResult.value.format !== 'png') return;

      // Should have parameters chunk with A1111 format
      expect(conversionResult.value.chunks.length).toBeGreaterThan(0);
      const parameters = conversionResult.value.chunks.find(
        (c) => c.keyword === 'parameters',
      );
      expect(parameters).toBeDefined();
      expect(parameters?.text).toMatch(/Steps:/);
    });
  });

  describe('Round-trip conversion', () => {
    test('PNG → JPEG → PNG should preserve data', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/forge-neo.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      // Parse original PNG
      const originalResult = parsePng(pngData);
      expect(originalResult.status).toBe('success');
      if (originalResult.status !== 'success') return;

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
      const originalParams =
        originalResult.raw.format === 'png'
          ? originalResult.raw.chunks.find((c) => c.keyword === 'parameters')
          : null;
      const resultParams = pngConversion.value.chunks.find(
        (c) => c.keyword === 'parameters',
      );

      expect(resultParams).toBeDefined();
      if (originalParams && resultParams) {
        expect(resultParams.text).toBe(originalParams.text);
      }
    });
  });
});
