import { describe, expect, it } from 'vitest';
import { read, write } from '../../src/index';
import {
  createMinimalJpeg,
  createMinimalPng,
  createMinimalWebp,
} from '../helpers/minimal-images';
import { expectNovelAIRawEqual, expectRawEqual } from '../helpers/raw-equal';
import {
  JPEG_SAMPLES,
  PNG_SAMPLES,
  WEBP_SAMPLES,
  isRawMismatchExpected,
  loadSample,
} from '../helpers/samples';

describe('Round-trip preservation', () => {
  // Minimal images for cross-format conversion targets
  const getJpegBase = createMinimalJpeg;
  const getWebpBase = createMinimalWebp;
  const getPngBase = createMinimalPng;

  describe('PNG → JPEG → PNG', () => {
    for (const filename of PNG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const pngOriginal = loadSample('png', filename);
        const originalMetadata = read(pngOriginal, { strict: true });
        expect(originalMetadata.status).toBe('success');
        if (originalMetadata.status !== 'success') return;

        // PNG → JPEG
        const jpegWithMetadata = write(getJpegBase(), originalMetadata);
        expect(jpegWithMetadata.ok).toBe(true);
        if (!jpegWithMetadata.ok) return;

        const jpegRead = read(jpegWithMetadata.value, { strict: true });
        expect(jpegRead.status).toBe('success');
        if (jpegRead.status !== 'success') return;

        // JPEG → PNG
        const pngRestored = write(pngOriginal, jpegRead);
        expect(pngRestored.ok).toBe(true);
        if (!pngRestored.ok) return;

        const finalRead = read(pngRestored.value, { strict: true });
        expect(finalRead.status).toBe('success');
        if (finalRead.status !== 'success') return;

        // Final metadata should match original
        expect(finalRead.metadata).toEqual(originalMetadata.metadata);

        // Raw comparison (skip for raw mismatch expected files)
        if (!isRawMismatchExpected(filename)) {
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        }
      });
    }
  });

  describe('PNG → WebP → PNG', () => {
    for (const filename of PNG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const pngOriginal = loadSample('png', filename);
        const originalMetadata = read(pngOriginal, { strict: true });
        expect(originalMetadata.status).toBe('success');
        if (originalMetadata.status !== 'success') return;

        // PNG → WebP
        const webpWithMetadata = write(getWebpBase(), originalMetadata);
        expect(webpWithMetadata.ok).toBe(true);
        if (!webpWithMetadata.ok) return;

        const webpRead = read(webpWithMetadata.value, { strict: true });
        expect(webpRead.status).toBe('success');
        if (webpRead.status !== 'success') return;

        // WebP → PNG
        const pngRestored = write(pngOriginal, webpRead);
        expect(pngRestored.ok).toBe(true);
        if (!pngRestored.ok) return;

        const finalRead = read(pngRestored.value, { strict: true });
        expect(finalRead.status).toBe('success');
        if (finalRead.status !== 'success') return;

        // Final metadata should match original
        expect(finalRead.metadata).toEqual(originalMetadata.metadata);

        // Raw comparison (skip for raw mismatch expected files)
        if (!isRawMismatchExpected(filename)) {
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        }
      });
    }
  });

  describe('JPEG → WebP → JPEG', () => {
    for (const filename of JPEG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const jpegOriginal = loadSample('jpg', filename);
        const originalMetadata = read(jpegOriginal, { strict: true });
        expect(originalMetadata.status).toBe('success');
        if (originalMetadata.status !== 'success') return;

        // JPEG → WebP
        const webpWithMetadata = write(getWebpBase(), originalMetadata);
        expect(webpWithMetadata.ok).toBe(true);
        if (!webpWithMetadata.ok) return;

        const webpRead = read(webpWithMetadata.value, { strict: true });
        expect(webpRead.status).toBe('success');
        if (webpRead.status !== 'success') return;

        // WebP → JPEG
        const jpegRestored = write(jpegOriginal, webpRead);
        expect(jpegRestored.ok).toBe(true);
        if (!jpegRestored.ok) return;

        const finalRead = read(jpegRestored.value, { strict: true });
        expect(finalRead.status).toBe('success');
        if (finalRead.status !== 'success') return;

        // Final metadata should match original
        expect(finalRead.metadata).toEqual(originalMetadata.metadata);

        // Raw comparison (skip for raw mismatch expected files)
        if (!isRawMismatchExpected(filename)) {
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        }
      });
    }
  });

  describe('JPEG → PNG → JPEG', () => {
    for (const filename of JPEG_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const jpegOriginal = loadSample('jpg', filename);
        const originalMetadata = read(jpegOriginal, { strict: true });
        expect(originalMetadata.status).toBe('success');
        if (originalMetadata.status !== 'success') return;

        // JPEG → PNG
        const pngWithMetadata = write(getPngBase(), originalMetadata);
        expect(pngWithMetadata.ok).toBe(true);
        if (!pngWithMetadata.ok) return;

        const pngRead = read(pngWithMetadata.value, { strict: true });
        expect(pngRead.status).toBe('success');
        if (pngRead.status !== 'success') return;

        // PNG → JPEG
        const jpegRestored = write(jpegOriginal, pngRead);
        expect(jpegRestored.ok).toBe(true);
        if (!jpegRestored.ok) return;

        const finalRead = read(jpegRestored.value, { strict: true });
        expect(finalRead.status).toBe('success');
        if (finalRead.status !== 'success') return;

        // Final metadata should match original
        expect(finalRead.metadata).toEqual(originalMetadata.metadata);

        // Raw comparison (skip for raw mismatch expected files)
        if (!isRawMismatchExpected(filename)) {
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        }
      });
    }
  });

  describe('WebP → PNG → WebP', () => {
    for (const filename of WEBP_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const webpOriginal = loadSample('webp', filename);
        const originalMetadata = read(webpOriginal, { strict: true });
        expect(originalMetadata.status).toBe('success');
        if (originalMetadata.status !== 'success') return;

        // WebP → PNG
        const pngWithMetadata = write(getPngBase(), originalMetadata);
        expect(pngWithMetadata.ok).toBe(true);
        if (!pngWithMetadata.ok) return;

        const pngRead = read(pngWithMetadata.value, { strict: true });
        expect(pngRead.status).toBe('success');
        if (pngRead.status !== 'success') return;

        // PNG → WebP
        const webpRestored = write(webpOriginal, pngRead);
        expect(webpRestored.ok).toBe(true);
        if (!webpRestored.ok) return;

        const finalRead = read(webpRestored.value, { strict: true });
        expect(finalRead.status).toBe('success');
        if (finalRead.status !== 'success') return;

        // Final metadata should match original
        expect(finalRead.metadata).toEqual(originalMetadata.metadata);

        // Raw comparison (skip for raw mismatch expected files)
        if (!isRawMismatchExpected(filename)) {
          // NovelAI needs special handling for Description correction
          if (filename.startsWith('novelai')) {
            expectNovelAIRawEqual(finalRead.raw, originalMetadata.raw);
          } else {
            expectRawEqual(finalRead.raw, originalMetadata.raw);
          }
        }
      });
    }
  });

  describe('WebP → JPEG → WebP', () => {
    for (const filename of WEBP_SAMPLES) {
      it(`should preserve metadata for ${filename}`, () => {
        const webpOriginal = loadSample('webp', filename);
        const originalMetadata = read(webpOriginal, { strict: true });
        expect(originalMetadata.status).toBe('success');
        if (originalMetadata.status !== 'success') return;

        // WebP → JPEG
        const jpegWithMetadata = write(getJpegBase(), originalMetadata);
        expect(jpegWithMetadata.ok).toBe(true);
        if (!jpegWithMetadata.ok) return;

        const jpegRead = read(jpegWithMetadata.value, { strict: true });
        expect(jpegRead.status).toBe('success');
        if (jpegRead.status !== 'success') return;

        // JPEG → WebP
        const webpRestored = write(webpOriginal, jpegRead);
        expect(webpRestored.ok).toBe(true);
        if (!webpRestored.ok) return;

        const finalRead = read(webpRestored.value, { strict: true });
        expect(finalRead.status).toBe('success');
        if (finalRead.status !== 'success') return;

        // Final metadata should match original
        expect(finalRead.metadata).toEqual(originalMetadata.metadata);

        // Raw comparison (skip for raw mismatch expected files)
        if (!isRawMismatchExpected(filename)) {
          // NovelAI needs special handling for Description correction
          if (filename.startsWith('novelai')) {
            expectNovelAIRawEqual(finalRead.raw, originalMetadata.raw);
          } else {
            expectRawEqual(finalRead.raw, originalMetadata.raw);
          }
        }
      });
    }
  });
});
