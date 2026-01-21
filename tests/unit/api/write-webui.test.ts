import { describe, expect, it } from 'vitest';
import { writeAsWebUI } from '../../../src/api/write-webui';
import { read } from '../../../src/index';
import type {
  ComfyUIMetadata,
  NovelAIMetadata,
  StandardMetadata,
} from '../../../src/types';

/**
 * Create a minimal valid PNG structure for testing
 */
function createMinimalPng(): Uint8Array {
  // PNG signature + IHDR + IEND
  return new Uint8Array([
    // Signature
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    // IHDR chunk (13 bytes data: width=1, height=1, bit depth=8, color type=6 RGBA)
    0x00,
    0x00,
    0x00,
    0x0d, // Length
    0x49,
    0x48,
    0x44,
    0x52, // "IHDR"
    0x00,
    0x00,
    0x00,
    0x01, // Width: 1
    0x00,
    0x00,
    0x00,
    0x01, // Height: 1
    0x08,
    0x06,
    0x00,
    0x00,
    0x00, // Bit depth, color type, compression, filter, interlace
    0x1f,
    0x15,
    0xc4,
    0x89, // CRC
    // IEND chunk
    0x00,
    0x00,
    0x00,
    0x00, // Length
    0x49,
    0x45,
    0x4e,
    0x44, // "IEND"
    0xae,
    0x42,
    0x60,
    0x82, // CRC
  ]);
}

/**
 * Create a minimal valid JPEG structure for testing
 */
function createMinimalJpeg(): Uint8Array {
  // Minimal JPEG: SOI + SOF0 + SOS + EOI
  return new Uint8Array([
    // SOI (Start of Image)
    0xff,
    0xd8,
    // SOF0 (Start of Frame, Baseline DCT)
    0xff,
    0xc0,
    0x00,
    0x0b, // Length (11 bytes)
    0x08, // Precision
    0x00,
    0x01, // Height: 1
    0x00,
    0x01, // Width: 1
    0x01, // Components: 1
    0x00,
    0x11,
    0x00, // Component info
    // SOS (Start of Scan)
    0xff,
    0xda,
    0x00,
    0x08, // Length
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00, // Scan data
    // EOI (End of Image)
    0xff,
    0xd9,
  ]);
}

/**
 * Create a minimal valid WebP structure for testing
 */
function createMinimalWebP(): Uint8Array {
  // Minimal WebP with VP8L (lossless)
  return new Uint8Array([
    // RIFF header
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x1a,
    0x00,
    0x00,
    0x00, // File size - 8
    0x57,
    0x45,
    0x42,
    0x50, // "WEBP"
    // VP8L chunk
    0x56,
    0x50,
    0x38,
    0x4c, // "VP8L"
    0x0e,
    0x00,
    0x00,
    0x00, // Chunk size
    0x2f, // Signature byte
    0x00,
    0x00,
    0x00,
    0x00, // Width/Height (1x1 encoded)
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // Data
  ]);
}

describe('writeAsWebUI - Unit Tests', () => {
  describe('error handling', () => {
    it('should return error for invalid image data', () => {
      const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: '',
        width: 512,
        height: 512,
      };

      const result = writeAsWebUI(invalidData, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });
  });

  describe('PNG writing', () => {
    it('should write ASCII-only metadata as tEXt chunk', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
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

      const result = writeAsWebUI(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify it can be read back
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.software).toBe('sd-webui');
          expect(readResult.metadata.prompt).toBe('masterpiece, 1girl');
          expect(readResult.metadata.negativePrompt).toBe(
            'lowres, bad quality',
          );
          expect(readResult.metadata.sampling?.steps).toBe(20);
          expect(readResult.metadata.sampling?.seed).toBe(12345);
        }
      }
    });

    it('should write non-ASCII metadata as iTXt chunk', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: '素晴らしい, 1girl, かわいい',
        negativePrompt: 'lowres',
        width: 512,
        height: 512,
      };

      const result = writeAsWebUI(png, metadata);

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

    it('should write minimal metadata with required fields', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'simple prompt',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
        },
      };

      const result = writeAsWebUI(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe('simple prompt');
        }
      }
    });
  });

  describe('JPEG writing', () => {
    it('should write metadata to JPEG as Exif UserComment', () => {
      const jpeg = createMinimalJpeg();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test prompt',
        negativePrompt: 'bad quality',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
          seed: 42,
        },
      };

      const result = writeAsWebUI(jpeg, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe('test prompt');
          expect(readResult.metadata.sampling?.seed).toBe(42);
        }
      }
    });
  });

  describe('WebP writing', () => {
    it('should write metadata to WebP as Exif UserComment', () => {
      const webp = createMinimalWebP();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'webp test',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
        },
      };

      const result = writeAsWebUI(webp, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          expect(readResult.metadata.prompt).toBe('webp test');
        }
      }
    });
  });

  describe('metadata conversion', () => {
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

      const result = writeAsWebUI(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          // Should be converted to WebUI format
          expect(readResult.metadata.software).toBe('sd-webui');
          // Main prompt should be preserved
          expect(readResult.metadata.prompt).toContain('main prompt');
          // Character prompts should be embedded as comments in the text
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

      const result = writeAsWebUI(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          // Should be converted to WebUI format (nodes are ignored)
          expect(readResult.metadata.software).toBe('sd-webui');
          expect(readResult.metadata.prompt).toBe('comfy prompt');
          expect(readResult.metadata.sampling?.seed).toBe(9999);
        }
      }
    });

    it('should maintain WebUI metadata as-is', () => {
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

      const result = writeAsWebUI(png, metadata);

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

  describe('user-created metadata', () => {
    it('should write completely custom metadata', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
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

      const result = writeAsWebUI(png, metadata);

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
    it('should handle empty prompts with required fields', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: '',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
        },
      };

      const result = writeAsWebUI(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        // Parser requires some AI markers (Negative prompt or Steps)
        expect(readResult.status).toBe('success');
      }
    });

    it('should handle multiline prompts', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'line1\\nline2\\nline3',
        negativePrompt: 'neg1\\nneg2',
        width: 512,
        height: 512,
      };

      const result = writeAsWebUI(png, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const readResult = read(result.value);
        expect(readResult.status).toBe('success');
        if (readResult.status === 'success') {
          // Line endings should be normalized
          expect(readResult.metadata.prompt).toContain('line1');
          expect(readResult.metadata.prompt).toContain('line2');
        }
      }
    });

    it('should handle zero seed', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'test',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: {
          seed: 0,
          steps: 20,
        },
      };

      const result = writeAsWebUI(png, metadata);

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
});
