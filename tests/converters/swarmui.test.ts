import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata } from '../../src/converters';
import { read } from '../../src/index';

const SAMPLES_DIR = path.join(__dirname, '../../samples');

describe('SwarmUI metadata conversion', () => {
  describe('PNG → JPEG/WebP conversion', () => {
    test('should convert swarmui.png to JPEG with combined JSON', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/swarmui.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = read(pngData);
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

    const additionalSamples = [
      'png/swarmui-hires.png',
      'png/swarmui-upscale.png',
    ];

    test.each(additionalSamples)('should convert %s', (samplePath) => {
      const fullPath = path.join(SAMPLES_DIR, samplePath);
      const data = new Uint8Array(fs.readFileSync(fullPath));

      const result = read(data);
      expect(result.status).toBe('success');
      if (result.status !== 'success') return;

      const conversion = convertMetadata(result, 'jpeg');
      expect(conversion.ok).toBe(true);
      if (!conversion.ok) return;

      expect(conversion.value.format).toBe('jpeg');
      if (conversion.value.format !== 'jpeg') return;

      // Verify segments are not empty
      expect(conversion.value.segments.length).toBeGreaterThan(0);

      // Should have exifUserComment with valid JSON
      const userComment = conversion.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();
      if (userComment) {
        const parsed = JSON.parse(userComment.data);
        expect(parsed.prompt).toBeDefined();
        expect(parsed.parameters).toBeDefined();
      }
    });
  });

  describe('JPEG/WebP → PNG conversion', () => {
    test('should convert swarmui.jpg to PNG with prompt and parameters', () => {
      const jpegPath = path.join(SAMPLES_DIR, 'jpg/swarmui.jpg');
      const jpegData = new Uint8Array(fs.readFileSync(jpegPath));

      const jpegResult = read(jpegData);
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

    test('should convert swarmui.webp to PNG', () => {
      const webpPath = path.join(SAMPLES_DIR, 'webp/swarmui.webp');
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
      // Note: swarmui.webp only has parameters chunk (no prompt)
      expect(keywords).toContain('parameters');
    });
  });

  describe('Round-trip conversion', () => {
    test('should preserve both chunks in round-trip (PNG → JPEG → PNG)', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/swarmui.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      // Parse original PNG
      const originalResult = read(pngData);
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

    const additionalRoundTripSamples = [
      'png/swarmui-hires.png',
      'png/swarmui-upscale.png',
    ];

    test.each(additionalRoundTripSamples)(
      'should preserve chunks in round-trip for %s (PNG → JPEG → PNG)',
      (samplePath) => {
        const fullPath = path.join(SAMPLES_DIR, samplePath);
        const data = new Uint8Array(fs.readFileSync(fullPath));

        const originalResult = read(data);
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
      },
    );
  });
});
