import { describe, expect, it } from 'vitest';
import { type ParseResult, read, write } from '../../src/index';
import {
  createMinimalJpeg,
  createMinimalPng,
  createMinimalWebp,
} from '../helpers/minimal-images';
import { expectRawEqual } from '../helpers/raw-equal';
import { expectRawStructure } from '../helpers/raw-structure';
import {
  JPEG_SAMPLES,
  loadSample,
  PNG_SAMPLES,
  WEBP_SAMPLES,
} from '../helpers/samples';

/**
 * Empty metadata for stripping all AI generation data
 */
const EMPTY_METADATA: ParseResult = { status: 'empty' };

describe('Format conversion accuracy', () => {
  // Minimal images for conversion targets
  const getJpegBase = createMinimalJpeg;
  const getWebpBase = createMinimalWebp;
  const getPngBase = createMinimalPng;

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

  // ============================================================================
  // Empty file conversions (no AI metadata)
  // ============================================================================

  /**
   * Empty sample files for edge case testing
   */
  const EMPTY_SAMPLES = {
    png: 'empty.png',
    jpg: 'empty.jpg',
    webp: 'empty.webp',
  } as const;

  describe('Empty file conversions', () => {
    it('should maintain empty status: PNG → JPEG → WebP → PNG', () => {
      // Start with empty PNG
      const pngData = loadSample('png', EMPTY_SAMPLES.png);
      const pngRead = read(pngData, { strict: true });
      expect(pngRead.status).toBe('empty');

      // PNG → JPEG
      const jpegConverted = write(getJpegBase(), EMPTY_METADATA);
      expect(jpegConverted.ok).toBe(true);
      if (!jpegConverted.ok) return;

      const jpegRead = read(jpegConverted.value, { strict: true });
      expect(jpegRead.status).toBe('empty');

      // JPEG → WebP
      const webpConverted = write(getWebpBase(), EMPTY_METADATA);
      expect(webpConverted.ok).toBe(true);
      if (!webpConverted.ok) return;

      const webpRead = read(webpConverted.value, { strict: true });
      expect(webpRead.status).toBe('empty');

      // WebP → PNG
      const pngConverted = write(getPngBase(), EMPTY_METADATA);
      expect(pngConverted.ok).toBe(true);
      if (!pngConverted.ok) return;

      const finalRead = read(pngConverted.value, { strict: true });
      expect(finalRead.status).toBe('empty');
    });

    it('should maintain empty status: JPEG → PNG', () => {
      const jpegData = loadSample('jpg', EMPTY_SAMPLES.jpg);
      const jpegRead = read(jpegData, { strict: true });
      expect(jpegRead.status).toBe('empty');

      const pngConverted = write(getPngBase(), EMPTY_METADATA);
      expect(pngConverted.ok).toBe(true);
      if (!pngConverted.ok) return;

      const pngRead = read(pngConverted.value, { strict: true });
      expect(pngRead.status).toBe('empty');
    });

    it('should maintain empty status: WebP → JPEG', () => {
      const webpData = loadSample('webp', EMPTY_SAMPLES.webp);
      const webpRead = read(webpData, { strict: true });
      expect(webpRead.status).toBe('empty');

      const jpegConverted = write(getJpegBase(), EMPTY_METADATA);
      expect(jpegConverted.ok).toBe(true);
      if (!jpegConverted.ok) return;

      const jpegRead = read(jpegConverted.value, { strict: true });
      expect(jpegRead.status).toBe('empty');
    });
  });

  // ============================================================================
  // GIMP file conversions (unrecognized metadata)
  // ============================================================================

  /**
   * GIMP sample files for unrecognized metadata testing
   */
  const GIMP_SAMPLES = {
    png: 'gimp.png',
    jpg: 'gimp.jpg',
    webp: 'gimp.webp',
  } as const;

  describe('GIMP file conversions (unrecognized metadata)', () => {
    // Same-format write: metadata should be preserved with raw equality
    it('should preserve GIMP PNG metadata when writing to different PNG', () => {
      const gimpData = loadSample('png', GIMP_SAMPLES.png);
      const gimpRead = read(gimpData, { strict: true });
      expect(gimpRead.status).toBe('unrecognized');
      if (gimpRead.status !== 'unrecognized') return;

      // Write to different PNG file (same format)
      const result = write(getPngBase(), gimpRead);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // No warning for same format
      expect(result.warning).toBeUndefined();

      // Metadata should be preserved
      const reread = read(result.value, { strict: true });
      expect(reread.status).toBe('unrecognized');
      if (reread.status !== 'unrecognized') return;

      // Raw should be equal
      expectRawEqual(reread.raw, gimpRead.raw);
    });

    it('should preserve GIMP JPEG metadata when writing to different JPEG', () => {
      const gimpData = loadSample('jpg', GIMP_SAMPLES.jpg);
      const gimpRead = read(gimpData, { strict: true });
      expect(gimpRead.status).toBe('unrecognized');
      if (gimpRead.status !== 'unrecognized') return;

      // Write to different JPEG file (same format)
      const result = write(getJpegBase(), gimpRead);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // No warning for same format
      expect(result.warning).toBeUndefined();

      // Metadata should be preserved
      const reread = read(result.value, { strict: true });
      expect(reread.status).toBe('unrecognized');
      if (reread.status !== 'unrecognized') return;

      // Raw should be equal
      expectRawEqual(reread.raw, gimpRead.raw);
    });

    it('should preserve GIMP WebP metadata when writing to different WebP', () => {
      const gimpData = loadSample('webp', GIMP_SAMPLES.webp);
      const gimpRead = read(gimpData, { strict: true });
      expect(gimpRead.status).toBe('unrecognized');
      if (gimpRead.status !== 'unrecognized') return;

      // Write to different WebP file (same format)
      const result = write(getWebpBase(), gimpRead);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // No warning for same format
      expect(result.warning).toBeUndefined();

      // Metadata should be preserved
      const reread = read(result.value, { strict: true });
      expect(reread.status).toBe('unrecognized');
      if (reread.status !== 'unrecognized') return;

      // Raw should be equal
      expectRawEqual(reread.raw, gimpRead.raw);
    });

    // Cross-format write: metadata should be dropped (by design)
    it('should drop GIMP PNG metadata when converting to JPEG', () => {
      const gimpData = loadSample('png', GIMP_SAMPLES.png);
      const gimpRead = read(gimpData, { strict: true });
      expect(gimpRead.status).toBe('unrecognized');

      // Write to different format (PNG → JPEG)
      const result = write(getJpegBase(), gimpRead);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Warning should indicate metadata was dropped
      expect(result.warning).toBeDefined();
      expect(result.warning?.type).toBe('metadataDropped');
      expect(result.warning?.reason).toBe('unrecognizedCrossFormat');

      // Metadata should be empty after cross-format write
      const reread = read(result.value, { strict: true });
      expect(reread.status).toBe('empty');
    });

    it('should drop GIMP PNG metadata when converting to WebP', () => {
      const gimpData = loadSample('png', GIMP_SAMPLES.png);
      const gimpRead = read(gimpData, { strict: true });
      expect(gimpRead.status).toBe('unrecognized');

      // Write to different format (PNG → WebP)
      const result = write(getWebpBase(), gimpRead);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Warning should indicate metadata was dropped
      expect(result.warning).toBeDefined();
      expect(result.warning?.type).toBe('metadataDropped');
      expect(result.warning?.reason).toBe('unrecognizedCrossFormat');

      // Metadata should be empty after cross-format write
      const reread = read(result.value, { strict: true });
      expect(reread.status).toBe('empty');
    });

    it('should drop GIMP JPEG metadata when converting to PNG', () => {
      const gimpData = loadSample('jpg', GIMP_SAMPLES.jpg);
      const gimpRead = read(gimpData, { strict: true });
      expect(gimpRead.status).toBe('unrecognized');

      // Write to different format (JPEG → PNG)
      const result = write(getPngBase(), gimpRead);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Warning should indicate metadata was dropped
      expect(result.warning).toBeDefined();
      expect(result.warning?.type).toBe('metadataDropped');
      expect(result.warning?.reason).toBe('unrecognizedCrossFormat');

      // Metadata should be empty after cross-format write
      const reread = read(result.value, { strict: true });
      expect(reread.status).toBe('empty');
    });
  });
});
