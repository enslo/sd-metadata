import { describe, expect, it } from 'vitest';
import { read, write } from '../../src/index';
import { expectNovelAIRawEqual, expectRawEqual } from '../helpers/raw-equal';
import {
  JPEG_CROSS_FORMAT_SAMPLES,
  JPEG_SAMPLES,
  PNG_CROSS_FORMAT_SAMPLES,
  PNG_SAMPLES,
  WEBP_CROSS_FORMAT_SAMPLES,
  WEBP_SAMPLES,
  loadSample,
} from '../helpers/samples';

describe('Round-trip preservation', () => {
  describe('Same-format round-trips', () => {
    describe('PNG → PNG', () => {
      for (const filename of PNG_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const original = loadSample('png', filename);
          const firstRead = read(original);

          // First read should succeed
          expect(firstRead.status).toBe('success');
          if (firstRead.status !== 'success') return;

          // Write metadata back
          const written = write(original, firstRead);
          expect(written.ok).toBe(true);
          if (!written.ok) return;

          // Read again
          const secondRead = read(written.value);
          expect(secondRead.status).toBe('success');
          if (secondRead.status !== 'success') return;

          // Metadata should be identical
          expect(secondRead.metadata).toEqual(firstRead.metadata);
          expectRawEqual(secondRead.raw, firstRead.raw);
        });
      }
    });

    describe('JPEG → JPEG', () => {
      for (const filename of JPEG_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const original = loadSample('jpg', filename);
          const firstRead = read(original);

          expect(firstRead.status).toBe('success');
          if (firstRead.status !== 'success') return;

          const written = write(original, firstRead);
          expect(written.ok).toBe(true);
          if (!written.ok) return;

          const secondRead = read(written.value);
          expect(secondRead.status).toBe('success');
          if (secondRead.status !== 'success') return;

          expect(secondRead.metadata).toEqual(firstRead.metadata);
          expectRawEqual(secondRead.raw, firstRead.raw);
        });
      }
    });

    describe('WebP → WebP', () => {
      for (const filename of WEBP_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const original = loadSample('webp', filename);
          const firstRead = read(original);

          expect(firstRead.status).toBe('success');
          if (firstRead.status !== 'success') return;

          const written = write(original, firstRead);
          expect(written.ok).toBe(true);
          if (!written.ok) return;

          const secondRead = read(written.value);
          expect(secondRead.status).toBe('success');
          if (secondRead.status !== 'success') return;

          expect(secondRead.metadata).toEqual(firstRead.metadata);
          expectRawEqual(secondRead.raw, firstRead.raw);
        });
      }
    });
  });

  describe('Cross-format round-trips', () => {
    // Base images for cross-format conversion (same as used in other integration tests)
    const getJpegBase = () => loadSample('jpg', 'civitai.jpeg');
    const getWebpBase = () => loadSample('webp', 'forge.webp');
    const getPngBase = () => loadSample('png', 'forge.png');

    describe('PNG → JPEG → PNG', () => {
      for (const filename of PNG_CROSS_FORMAT_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const pngOriginal = loadSample('png', filename);
          const originalMetadata = read(pngOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // PNG → JPEG
          const jpegWithMetadata = write(getJpegBase(), originalMetadata);
          expect(jpegWithMetadata.ok).toBe(true);
          if (!jpegWithMetadata.ok) return;

          const jpegRead = read(jpegWithMetadata.value);
          expect(jpegRead.status).toBe('success');
          if (jpegRead.status !== 'success') return;

          // Verify intermediate state: metadata should be correctly parsed in JPEG format
          expect(jpegRead.metadata).toEqual(originalMetadata.metadata);

          // JPEG → PNG
          const pngRestored = write(pngOriginal, jpegRead);
          expect(pngRestored.ok).toBe(true);
          if (!pngRestored.ok) return;

          const finalRead = read(pngRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          // Metadata should match original
          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('PNG → WebP → PNG', () => {
      for (const filename of PNG_CROSS_FORMAT_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const pngOriginal = loadSample('png', filename);
          const originalMetadata = read(pngOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // PNG → WebP
          const webpWithMetadata = write(getWebpBase(), originalMetadata);
          expect(webpWithMetadata.ok).toBe(true);
          if (!webpWithMetadata.ok) return;

          const webpRead = read(webpWithMetadata.value);
          expect(webpRead.status).toBe('success');
          if (webpRead.status !== 'success') return;

          // Verify intermediate state: metadata should be correctly parsed in WebP format
          expect(webpRead.metadata).toEqual(originalMetadata.metadata);

          // WebP → PNG
          const pngRestored = write(pngOriginal, webpRead);
          expect(pngRestored.ok).toBe(true);
          if (!pngRestored.ok) return;

          const finalRead = read(pngRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('JPEG → WebP → JPEG', () => {
      for (const filename of JPEG_CROSS_FORMAT_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const jpegOriginal = loadSample('jpg', filename);
          const originalMetadata = read(jpegOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // JPEG → WebP
          const webpWithMetadata = write(getWebpBase(), originalMetadata);
          expect(webpWithMetadata.ok).toBe(true);
          if (!webpWithMetadata.ok) return;

          const webpRead = read(webpWithMetadata.value);
          expect(webpRead.status).toBe('success');
          if (webpRead.status !== 'success') return;

          // Verify intermediate state: metadata should be correctly parsed in WebP format
          expect(webpRead.metadata).toEqual(originalMetadata.metadata);

          // WebP → JPEG
          const jpegRestored = write(jpegOriginal, webpRead);
          expect(jpegRestored.ok).toBe(true);
          if (!jpegRestored.ok) return;

          const finalRead = read(jpegRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('JPEG → PNG → JPEG', () => {
      for (const filename of JPEG_CROSS_FORMAT_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const jpegOriginal = loadSample('jpg', filename);
          const originalMetadata = read(jpegOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // JPEG → PNG
          const pngWithMetadata = write(getPngBase(), originalMetadata);
          expect(pngWithMetadata.ok).toBe(true);
          if (!pngWithMetadata.ok) return;

          const pngRead = read(pngWithMetadata.value);
          expect(pngRead.status).toBe('success');
          if (pngRead.status !== 'success') return;

          // Verify intermediate state: metadata should be correctly parsed in PNG format
          expect(pngRead.metadata).toEqual(originalMetadata.metadata);

          // PNG → JPEG
          const jpegRestored = write(jpegOriginal, pngRead);
          expect(jpegRestored.ok).toBe(true);
          if (!jpegRestored.ok) return;

          const finalRead = read(jpegRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('WebP → PNG → WebP', () => {
      for (const filename of WEBP_CROSS_FORMAT_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const webpOriginal = loadSample('webp', filename);
          const originalMetadata = read(webpOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // WebP → PNG
          const pngWithMetadata = write(getPngBase(), originalMetadata);
          expect(pngWithMetadata.ok).toBe(true);
          if (!pngWithMetadata.ok) return;

          const pngRead = read(pngWithMetadata.value);
          expect(pngRead.status).toBe('success');
          if (pngRead.status !== 'success') return;

          // Verify intermediate state: metadata should be correctly parsed in PNG format
          expect(pngRead.metadata).toEqual(originalMetadata.metadata);

          // PNG → WebP
          const webpRestored = write(webpOriginal, pngRead);
          expect(webpRestored.ok).toBe(true);
          if (!webpRestored.ok) return;

          const finalRead = read(webpRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          // Parsed metadata should always match
          expect(finalRead.metadata).toEqual(originalMetadata.metadata);

          // Raw metadata validation (NovelAI needs special handling for Description correction)
          if (filename.startsWith('novelai')) {
            expectNovelAIRawEqual(finalRead.raw, originalMetadata.raw);
          } else {
            expectRawEqual(finalRead.raw, originalMetadata.raw);
          }
        });
      }
    });

    describe('WebP → JPEG → WebP', () => {
      for (const filename of WEBP_CROSS_FORMAT_SAMPLES) {
        it(`should preserve metadata for ${filename}`, () => {
          const webpOriginal = loadSample('webp', filename);
          const originalMetadata = read(webpOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // WebP → JPEG
          const jpegWithMetadata = write(getJpegBase(), originalMetadata);
          expect(jpegWithMetadata.ok).toBe(true);
          if (!jpegWithMetadata.ok) return;

          const jpegRead = read(jpegWithMetadata.value);
          expect(jpegRead.status).toBe('success');
          if (jpegRead.status !== 'success') return;

          // Verify intermediate state: metadata should be correctly parsed in JPEG format
          expect(jpegRead.metadata).toEqual(originalMetadata.metadata);

          // JPEG → WebP
          const webpRestored = write(webpOriginal, jpegRead);
          expect(webpRestored.ok).toBe(true);
          if (!webpRestored.ok) return;

          const finalRead = read(webpRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);

          // Raw metadata validation (NovelAI needs special handling for Description correction)
          if (filename.startsWith('novelai')) {
            expectNovelAIRawEqual(finalRead.raw, originalMetadata.raw);
          } else {
            expectRawEqual(finalRead.raw, originalMetadata.raw);
          }
        });
      }
    });
  });
});
