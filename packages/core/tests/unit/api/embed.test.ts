import { describe, expect, it } from 'vitest';
import { embed } from '../../../src/api/embed';
import { read } from '../../../src/index';
import type {
  ComfyUIMetadata,
  EmbedMetadata,
  NovelAIMetadata,
  StandardMetadata,
} from '../../../src/types';

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

  describe('non-ASCII encoding', () => {
    it('should write non-ASCII metadata as iTXt chunk in PNG', () => {
      const png = createMinimalPng();
      const metadata: EmbedMetadata = {
        prompt: '素晴らしい, 1girl, かわいい',
        negativePrompt: 'lowres',
        width: 512,
        height: 512,
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe(
            '素晴らしい, 1girl, かわいい',
          );
        }
      }
    });
  });

  describe('GenerationMetadata input', () => {
    it('should convert NovelAI metadata to WebUI format', () => {
      const png = createMinimalPng();
      const metadata: NovelAIMetadata = {
        software: 'novelai',
        prompt: 'main prompt',
        negativePrompt: 'bad quality',
        width: 1024,
        height: 1024,
        characterPrompts: [
          {
            prompt: '1girl, hatsune miku',
            center: { x: 0.5, y: 0.3 },
          },
        ],
        sampling: {
          steps: 28,
          seed: 123456,
        },
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.software).toBe('sd-webui');
          expect(readResult.metadata.prompt).toContain('main prompt');
          expect(readResult.metadata.sampling?.seed).toBe(123456);
        }
      }
    });

    it('should convert ComfyUI metadata to WebUI format', () => {
      const png = createMinimalPng();
      const metadata: ComfyUIMetadata = {
        software: 'comfyui',
        prompt: 'comfy prompt',
        negativePrompt: 'comfy negative',
        width: 512,
        height: 512,
        nodes: {
          '1': {
            class_type: 'KSampler',
            inputs: { seed: 9999, steps: 30 },
          },
        },
        sampling: {
          seed: 9999,
          steps: 30,
        },
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.software).toBe('sd-webui');
          expect(readResult.metadata.prompt).toBe('comfy prompt');
          expect(readResult.metadata.sampling?.seed).toBe(9999);
        }
      }
    });

    it('should pass through StandardMetadata as-is', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'original webui',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: {
          steps: 25,
          sampler: 'DPM++ 2M',
          seed: 777,
        },
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.software).toBe('sd-webui');
          expect(readResult.metadata.prompt).toBe('original webui');
          expect(readResult.metadata.sampling?.sampler).toBe('DPM++ 2M');
        }
      }
    });
  });

  describe('hires settings', () => {
    it('should round-trip metadata with hires settings', () => {
      const png = createMinimalPng();
      const metadata: EmbedMetadata = {
        prompt: 'fantasy landscape, epic, dramatic lighting',
        negativePrompt: 'lowres, bad anatomy, ugly',
        width: 1024,
        height: 768,
        model: {
          name: 'my-custom-model-v2.safetensors',
          hash: 'deadbeef1234',
        },
        sampling: {
          steps: 35,
          sampler: 'Euler a',
          scheduler: 'Karras',
          cfg: 8.5,
          seed: 424242,
          clipSkip: 2,
        },
        hires: {
          scale: 2,
          upscaler: 'R-ESRGAN 4x+',
          steps: 15,
          denoise: 0.45,
        },
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          const meta = readResult.metadata;
          expect(meta.prompt).toBe(
            'fantasy landscape, epic, dramatic lighting',
          );
          expect(meta.model?.name).toBe('my-custom-model-v2.safetensors');
          expect(meta.sampling?.steps).toBe(35);
          expect(meta.sampling?.cfg).toBe(8.5);
          expect(meta.sampling?.seed).toBe(424242);
          expect(meta.sampling?.clipSkip).toBe(2);
          expect(meta.hires?.scale).toBe(2);
          expect(meta.hires?.upscaler).toBe('R-ESRGAN 4x+');
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', () => {
      const png = createMinimalPng();
      const metadata: EmbedMetadata = {
        prompt: '',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: { steps: 20 },
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
      }
    });

    it('should handle multiline prompts', () => {
      const png = createMinimalPng();
      const metadata: EmbedMetadata = {
        prompt: 'line1\nline2\nline3',
        negativePrompt: 'neg1\nneg2',
        width: 512,
        height: 512,
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toContain('line1');
          expect(readResult.metadata.prompt).toContain('line2');
        }
      }
    });

    it('should handle zero seed', () => {
      const png = createMinimalPng();
      const metadata: EmbedMetadata = {
        prompt: 'test',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: { seed: 0, steps: 20 },
      };

      const result = embed(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.sampling?.seed).toBe(0);
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
