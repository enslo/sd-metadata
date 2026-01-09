import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { convertMetadata, parseJpeg, parsePng, parseWebp } from '../../src';

const SAMPLES_DIR = path.join(__dirname, '../../samples');

describe('ComfyUI metadata conversion', () => {
  describe('PNG → JPEG/WebP conversion', () => {
    test('should convert comfyui.png to JPEG with prompt and workflow', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/comfyui.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      const pngResult = parsePng(pngData);
      expect(pngResult.status).toBe('success');
      if (pngResult.status !== 'success') return;

      expect(pngResult.metadata.software).toBe('comfyui');

      // Convert to JPEG format
      const conversionResult = convertMetadata(pngResult, 'jpeg');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('jpeg');
      if (conversionResult.value.format !== 'jpeg') return;

      // Should have exifUserComment
      expect(conversionResult.value.segments.length).toBeGreaterThan(0);
      const userComment = conversionResult.value.segments.find(
        (s) => s.source.type === 'exifUserComment',
      );
      expect(userComment).toBeDefined();

      // Should be valid JSON with prompt and workflow
      if (userComment) {
        const parsed = JSON.parse(userComment.data);
        expect(parsed.prompt).toBeDefined();
        expect(parsed.workflow).toBeDefined();
      }
    });

    // Additional ComfyUI PNG samples
    const additionalPngSamples = [
      'png/comfyui-hires.png',
      'png/comfyui-upscale.png',
      'png/comfyui-saveimage-plus.png',
      'png/comfyui-save-image-extended.png',
      'png/comfyui-saveimagewithmetadata.png',
    ];

    test.each(additionalPngSamples)(
      'should convert %s to JPEG with ComfyUI JSON',
      (samplePath) => {
        const fullPath = path.join(SAMPLES_DIR, samplePath);
        const data = new Uint8Array(fs.readFileSync(fullPath));

        const result = parsePng(data);
        expect(result.status).toBe('success');
        if (result.status !== 'success') return;

        expect(result.metadata.software).toBe('comfyui');

        const conversion = convertMetadata(result, 'jpeg');
        expect(conversion.ok).toBe(true);
        if (!conversion.ok) return;

        expect(conversion.value.format).toBe('jpeg');
        if (conversion.value.format !== 'jpeg') return;

        // Verify segments
        expect(conversion.value.segments.length).toBeGreaterThan(0);
        const userComment = conversion.value.segments.find(
          (s) => s.source.type === 'exifUserComment',
        );
        expect(userComment).toBeDefined();

        // Should be valid JSON with prompt and workflow
        if (userComment) {
          const parsed = JSON.parse(userComment.data);
          expect(parsed.prompt).toBeDefined();
          expect(parsed.workflow).toBeDefined();
        }
      },
    );
  });

  describe('JPEG/WebP → PNG conversion', () => {
    test('should convert saveimage-plus JPEG to PNG format', () => {
      const jpegPath = path.join(SAMPLES_DIR, 'jpg/comfyui-saveimage-plus.jpg');
      const jpegData = new Uint8Array(fs.readFileSync(jpegPath));

      const jpegResult = parseJpeg(jpegData);
      expect(jpegResult.status).toBe('success');
      if (jpegResult.status !== 'success') return;

      expect(jpegResult.metadata.software).toBe('comfyui');

      // Convert to PNG format
      const conversionResult = convertMetadata(jpegResult, 'png');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('png');
      if (conversionResult.value.format !== 'png') return;

      // Should have prompt and workflow chunks
      const keywords = conversionResult.value.chunks.map((c) => c.keyword);
      expect(keywords).toContain('prompt');
      expect(keywords).toContain('workflow');
    });

    test('should convert save-image-extended JPEG to PNG format', () => {
      const jpegPath = path.join(
        SAMPLES_DIR,
        'jpg/comfyui-save-image-extended.jpeg',
      );
      const jpegData = new Uint8Array(fs.readFileSync(jpegPath));

      const jpegResult = parseJpeg(jpegData);
      expect(jpegResult.status).toBe('success');
      if (jpegResult.status !== 'success') return;

      expect(jpegResult.metadata.software).toBe('comfyui');

      // Convert to PNG format
      const conversionResult = convertMetadata(jpegResult, 'png');
      expect(conversionResult.ok).toBe(true);
      if (!conversionResult.ok) return;

      expect(conversionResult.value.format).toBe('png');
      if (conversionResult.value.format !== 'png') return;

      // Should have prompt and workflow chunks (from exifMake and exifImageDescription)
      const keywords = conversionResult.value.chunks.map((c) => c.keyword);
      expect(keywords).toContain('prompt');
      expect(keywords).toContain('workflow');
    });
  });

  describe('Round-trip conversion', () => {
    test('PNG → JPEG → PNG should preserve both chunks', () => {
      const pngPath = path.join(SAMPLES_DIR, 'png/comfyui.png');
      const pngData = new Uint8Array(fs.readFileSync(pngPath));

      // Parse original PNG
      const originalResult = parsePng(pngData);
      expect(originalResult.status).toBe('success');
      if (originalResult.status !== 'success') return;

      const originalChunks =
        originalResult.raw.format === 'png' ? originalResult.raw.chunks : [];
      const originalPrompt = originalChunks.find((c) => c.keyword === 'prompt');

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

      // Should have both chunks
      const keywords = pngConversion.value.chunks.map((c) => c.keyword);
      expect(keywords).toContain('prompt');
      expect(keywords).toContain('workflow');

      // Prompt content should match (as parsed JSON)
      const resultPrompt = pngConversion.value.chunks.find(
        (c) => c.keyword === 'prompt',
      );
      if (originalPrompt && resultPrompt) {
        const originalParsed = JSON.parse(originalPrompt.text);
        const resultParsed = JSON.parse(resultPrompt.text);
        expect(resultParsed).toEqual(originalParsed);
      }
    });
  });
});
