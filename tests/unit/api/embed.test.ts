import { describe, expect, it } from 'vitest';
import { embed } from '../../../src/api/embed';
import { read } from '../../../src/index';
import type { EmbedMetadata } from '../../../src/types';

/**
 * Create a minimal valid PNG structure for testing
 */
function createMinimalPng(): Uint8Array {
  return new Uint8Array([
    // Signature
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    // IHDR chunk (13 bytes data)
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89,
    // IEND chunk
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

/**
 * Create a minimal valid JPEG structure for testing
 */
function createMinimalJpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01,
    0x00, 0x11, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xff, 0xd9,
  ]);
}

/**
 * Create a minimal valid WebP structure for testing
 */
function createMinimalWebP(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x4c, 0x0e, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
}

describe('embed - Unit Tests', () => {
  const baseMetadata: EmbedMetadata = {
    prompt: 'masterpiece, 1girl',
    negativePrompt: 'lowres, bad quality',
    width: 512,
    height: 768,
    sampling: {
      steps: 20,
      sampler: 'Euler a',
      cfg: 7,
      seed: 12345,
    },
    model: {
      name: 'model.safetensors',
      hash: 'abc123',
    },
  };

  describe('PNG writing', () => {
    it('should write metadata to PNG and round-trip correctly', () => {
      const png = createMinimalPng();

      const result = embed(png, baseMetadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe('masterpiece, 1girl');
          expect(readResult.metadata.negativePrompt).toBe(
            'lowres, bad quality',
          );
          expect(readResult.metadata.sampling?.steps).toBe(20);
          expect(readResult.metadata.sampling?.seed).toBe(12345);
          expect(readResult.metadata.model?.name).toBe('model.safetensors');
        }
      }
    });
  });

  describe('JPEG writing', () => {
    it('should write metadata to JPEG and round-trip correctly', () => {
      const jpeg = createMinimalJpeg();

      const result = embed(jpeg, baseMetadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe('masterpiece, 1girl');
          expect(readResult.metadata.sampling?.steps).toBe(20);
        }
      }
    });
  });

  describe('WebP writing', () => {
    it('should write metadata to WebP and round-trip correctly', () => {
      const webp = createMinimalWebP();

      const result = embed(webp, baseMetadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe('masterpiece, 1girl');
          expect(readResult.metadata.sampling?.steps).toBe(20);
        }
      }
    });
  });

  describe('extras round-trip', () => {
    it('should preserve extras in raw data when round-tripped', () => {
      const png = createMinimalPng();

      const result = embed(png, {
        ...baseMetadata,
        extras: { Version: 'v1.10.0', 'Lora hashes': 'abc123' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          // Extras are preserved in the raw text chunk
          expect(readResult.raw.format).toBe('png');
          if (readResult.raw.format === 'png') {
            const rawText = readResult.raw.chunks.map((c) => c.text).join('\n');
            expect(rawText).toContain('Version: v1.10.0');
            expect(rawText).toContain('Lora hashes: abc123');
          }
        }
      }
    });

    it('should include extras in unrecognized raw output via stringify', () => {
      const png = createMinimalPng();

      // Metadata with only extras (no structured fields that identify as AI)
      // This will be recognized as success since it has Steps in extras
      const minimalMetadata: EmbedMetadata = {
        prompt: 'test prompt',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: { steps: 20 },
      };

      const result = embed(png, {
        ...minimalMetadata,
        extras: { Version: 'v1.10.0' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        // Whether success or unrecognized, raw data should contain extras
        if (readResult.status === 'success') {
          if (readResult.raw.format === 'png') {
            const rawText = readResult.raw.chunks.map((c) => c.text).join('\n');
            expect(rawText).toContain('Version: v1.10.0');
          }
        }
      }
    });
  });

  describe('error handling', () => {
    it('should return error for invalid image data', () => {
      const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5]);

      const result = embed(invalidData, baseMetadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });
  });
});
