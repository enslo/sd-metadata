import { describe, expect, it } from 'vitest';
import { read, write } from '../../src/index';
import { expectRawStructure } from '../helpers/raw-structure';
import {
  JPEG_SAMPLES,
  PNG_SAMPLES,
  WEBP_SAMPLES,
  loadSample,
} from '../helpers/samples';

describe('Format conversion accuracy', () => {
  // Base images for conversion targets
  const getJpegBase = () => loadSample('jpg', 'civitai.jpeg');
  const getWebpBase = () => loadSample('webp', 'forge.webp');
  const getPngBase = () => loadSample('png', 'forge.png');

  // ============================================================================
  // Same-format conversions
  // ============================================================================

  describe('PNG → PNG', () => {
    for (const filename of PNG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const original = loadSample('png', filename);
        const parseResult = read(original, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(original, parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'png',
        );
      });
    }
  });

  describe('JPEG → JPEG', () => {
    for (const filename of JPEG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const original = loadSample('jpg', filename);
        const parseResult = read(original, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(original, parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'jpeg',
        );
      });
    }
  });

  describe('WebP → WebP', () => {
    for (const filename of WEBP_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const original = loadSample('webp', filename);
        const parseResult = read(original, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(original, parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'webp',
        );
      });
    }
  });

  // ============================================================================
  // Cross-format conversions: PNG source
  // ============================================================================

  describe('PNG → JPEG', () => {
    for (const filename of PNG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const pngData = loadSample('png', filename);
        const parseResult = read(pngData, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(getJpegBase(), parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'jpeg',
        );
      });
    }
  });

  describe('PNG → WebP', () => {
    for (const filename of PNG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const pngData = loadSample('png', filename);
        const parseResult = read(pngData, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(getWebpBase(), parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'webp',
        );
      });
    }
  });

  // ============================================================================
  // Cross-format conversions: JPEG source
  // ============================================================================

  describe('JPEG → PNG', () => {
    for (const filename of JPEG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const jpegData = loadSample('jpg', filename);
        const parseResult = read(jpegData, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(getPngBase(), parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'png',
        );
      });
    }
  });

  describe('JPEG → WebP', () => {
    for (const filename of JPEG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const jpegData = loadSample('jpg', filename);
        const parseResult = read(jpegData, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(getWebpBase(), parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'webp',
        );
      });
    }
  });

  // ============================================================================
  // Cross-format conversions: WebP source
  // ============================================================================

  describe('WebP → PNG', () => {
    for (const filename of WEBP_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const webpData = loadSample('webp', filename);
        const parseResult = read(webpData, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(getPngBase(), parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'png',
        );
      });
    }
  });

  describe('WebP → JPEG', () => {
    for (const filename of WEBP_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const webpData = loadSample('webp', filename);
        const parseResult = read(webpData, { strict: true });
        expect(parseResult.status).toBe('success');
        if (parseResult.status !== 'success') return;

        const converted = write(getJpegBase(), parseResult);
        expect(converted.ok).toBe(true);
        if (!converted.ok) return;

        const convertedRead = read(converted.value, { strict: true });
        expect(convertedRead.status).toBe('success');
        if (convertedRead.status !== 'success') return;

        // Full metadata comparison
        expect(convertedRead.metadata).toEqual(parseResult.metadata);

        // Raw structure verification
        expectRawStructure(
          convertedRead.raw,
          parseResult.metadata.software,
          'jpeg',
        );
      });
    }
  });
});
