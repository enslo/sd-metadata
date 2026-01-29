import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeAsWebUI } from '../../src/api/write-webui';
import { read } from '../../src/index';
import type { StandardMetadata } from '../../src/types';
import {
  createMinimalJpeg,
  createMinimalPng,
  createMinimalWebp,
} from '../helpers/minimal-images';

/**
 * Load a sample file from the samples directory
 */
function loadSample(
  format: 'png' | 'jpg' | 'webp',
  filename: string,
): Uint8Array {
  const dirName = format === 'jpg' ? 'jpg' : format;
  const filePath = path.join(__dirname, '../../samples', dirName, filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

describe('writeAsWebUI - Integration Tests', () => {
  describe('round-trip tests', () => {
    it('should allow reading back written metadata (PNG)', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'custom test prompt, masterpiece',
        negativePrompt: 'lowres, bad quality',
        width: 512,
        height: 768,
        model: {
          name: 'test-model.safetensors',
          hash: 'abcd1234',
        },
        sampling: {
          steps: 25,
          sampler: 'Euler a',
          cfg: 7.5,
          seed: 424242,
        },
      };

      // Write metadata
      const writeResult = writeAsWebUI(png, metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read back
      const readResult = read(writeResult.value);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      // Verify metadata matches
      expect(readResult.metadata.software).toBe('sd-webui');
      expect(readResult.metadata.prompt).toBe(
        'custom test prompt, masterpiece',
      );
      expect(readResult.metadata.negativePrompt).toBe('lowres, bad quality');
      expect(readResult.metadata.width).toBe(512);
      expect(readResult.metadata.height).toBe(768);
      expect(readResult.metadata.model?.name).toBe('test-model.safetensors');
      expect(readResult.metadata.sampling?.steps).toBe(25);
      expect(readResult.metadata.sampling?.seed).toBe(424242);
    });

    it('should allow reading back written metadata (JPEG)', () => {
      const jpeg = createMinimalJpeg();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'fantasy landscape, epic',
        negativePrompt: 'bad anatomy',
        width: 1024,
        height: 768,
        sampling: {
          steps: 30,
          seed: 99999,
        },
      };

      const writeResult = writeAsWebUI(jpeg, metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = read(writeResult.value);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      expect(readResult.metadata.prompt).toBe('fantasy landscape, epic');
      expect(readResult.metadata.sampling?.seed).toBe(99999);
    });

    it('should allow reading back written metadata (WebP)', () => {
      const webp = createMinimalWebp();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'webp integration test',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: {
          steps: 20,
        },
      };

      const writeResult = writeAsWebUI(webp, metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = read(writeResult.value);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      expect(readResult.metadata.prompt).toBe('webp integration test');
    });

    it('should handle multiple write-read cycles', () => {
      const png = createMinimalPng();
      const metadata1: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'first version',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: { seed: 111, steps: 20 },
      };

      // First write
      const write1 = writeAsWebUI(png, metadata1);
      expect(write1.ok).toBe(true);
      if (!write1.ok) return;

      // Read back
      const read1 = read(write1.value);
      expect(read1.status).toBe('success');
      if (read1.status !== 'success') return;
      expect(read1.metadata.prompt).toContain('first version');

      // Modify and write again
      const metadata2: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'second version',
        negativePrompt: 'bad',
        width: 512,
        height: 512,
        sampling: { seed: 222, steps: 20 },
      };

      const write2 = writeAsWebUI(write1.value, metadata2);
      expect(write2.ok).toBe(true);
      if (!write2.ok) return;

      const read2 = read(write2.value);
      expect(read2.status).toBe('success');
      if (read2.status !== 'success') return;
      expect(read2.metadata.prompt).toBe('second version');
      expect(read2.metadata.sampling?.seed).toBe(222);
    });
  });

  describe('cross-tool conversion tests', () => {
    it('should convert NovelAI PNG to JPEG in WebUI format', () => {
      const novelaiPng = loadSample('png', 'novelai-full.png');
      const readResult = read(novelaiPng);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      // Get base JPEG (minimal image for clean write target)
      const jpegBase = createMinimalJpeg();

      // Write NovelAI metadata to JPEG in WebUI format
      const writeResult = writeAsWebUI(jpegBase, readResult.metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      // Read back
      const jpegRead = read(writeResult.value);
      expect(jpegRead.status).toBe('success');
      if (jpegRead.status !== 'success') return;

      // Should be WebUI format now
      expect(jpegRead.metadata.software).toBe('sd-webui');
      // Main prompt should be preserved
      expect(jpegRead.metadata.prompt).toBe(readResult.metadata.prompt);
      // Sampling info should be preserved
      expect(jpegRead.metadata.sampling?.seed).toBe(
        readResult.metadata.sampling?.seed,
      );
    });

    it('should convert ComfyUI PNG to WebP in WebUI format', () => {
      const comfyPng = loadSample('png', 'comfyui.png');
      const readResult = read(comfyPng);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      const webpBase = createMinimalWebp();

      const writeResult = writeAsWebUI(webpBase, readResult.metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const webpRead = read(writeResult.value);
      expect(webpRead.status).toBe('success');
      if (webpRead.status !== 'success') return;

      expect(webpRead.metadata.software).toBe('sd-webui');
      // Prompt content is preserved (trailing space is normalized)
      expect(webpRead.metadata.prompt).toContain('hatsune miku');
    });

    it('should handle conversion with character prompts (NovelAI)', () => {
      const novelaiPng = loadSample('png', 'novelai-full-3char.png');
      const readResult = read(novelaiPng);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      const pngBase = createMinimalPng();

      const writeResult = writeAsWebUI(pngBase, readResult.metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const pngRead = read(writeResult.value);
      expect(pngRead.status).toBe('success');
      if (pngRead.status !== 'success') return;

      // Should preserve main prompt (character prompts are embedded separately)
      expect(pngRead.metadata.prompt).toContain(readResult.metadata.prompt);
      // Character prompts should be embedded in the text format
      expect(pngRead.metadata.software).toBe('sd-webui');
    });

    it('should preserve hires settings across conversion', () => {
      const forgePng = loadSample('png', 'forge-hires.png');
      const readResult = read(forgePng);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      const jpegBase = createMinimalJpeg();

      const writeResult = writeAsWebUI(jpegBase, readResult.metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const jpegRead = read(writeResult.value);
      expect(jpegRead.status).toBe('success');
      if (jpegRead.status !== 'success') return;

      // Hires settings should be preserved
      expect(jpegRead.metadata.hires).toBeDefined();
      if (jpegRead.metadata.hires && readResult.metadata.hires) {
        expect(jpegRead.metadata.hires.scale).toBe(
          readResult.metadata.hires.scale,
        );
        expect(jpegRead.metadata.hires.upscaler).toBe(
          readResult.metadata.hires.upscaler,
        );
      }
    });
  });

  describe('metadata modification tests', () => {
    it('should allow modifying existing metadata before writing', () => {
      const forgePng = loadSample('png', 'forge.png');
      const readResult = read(forgePng);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      //Modify metadata - use explicit typing to avoid spread type issues
      const modifiedMetadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: `MODIFIED: ${readResult.metadata.prompt}`,
        negativePrompt: readResult.metadata.negativePrompt || '',
        width: readResult.metadata.width,
        height: readResult.metadata.height,
        sampling: {
          seed: 999999,
          steps: 50,
        },
      };

      // Write to minimal image (clean target)
      const writeResult = writeAsWebUI(createMinimalPng(), modifiedMetadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const modifiedRead = read(writeResult.value);
      expect(modifiedRead.status).toBe('success');
      if (modifiedRead.status !== 'success') return;

      expect(modifiedRead.metadata.prompt).toContain('MODIFIED:');
      expect(modifiedRead.metadata.sampling?.seed).toBe(999999);
      expect(modifiedRead.metadata.sampling?.steps).toBe(50);
    });

    it('should allow adding fields to minimal metadata', () => {
      const png = createMinimalPng();

      // Start with minimal metadata
      const minimalMetadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'minimal',
        negativePrompt: '',
        width: 512,
        height: 512,
      };

      const write1 = writeAsWebUI(png, minimalMetadata);
      expect(write1.ok).toBe(true);
      if (!write1.ok) return;

      // Add more fields
      const enhancedMetadata: StandardMetadata = {
        ...minimalMetadata,
        model: {
          name: 'enhanced-model.safetensors',
          hash: 'xyz789',
        },
        sampling: {
          steps: 30,
          sampler: 'DPM++ 2M Karras',
          cfg: 8.5,
          seed: 12345,
        },
        hires: {
          scale: 2,
          upscaler: 'R-ESRGAN 4x+',
        },
      };

      const write2 = writeAsWebUI(write1.value, enhancedMetadata);
      expect(write2.ok).toBe(true);
      if (!write2.ok) return;

      const read2 = read(write2.value);
      expect(read2.status).toBe('success');
      if (read2.status !== 'success') return;

      expect(read2.metadata.model?.name).toBe('enhanced-model.safetensors');
      expect(read2.metadata.sampling?.steps).toBe(30);
      expect(read2.metadata.hires?.scale).toBe(2);
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle Unicode characters in prompts', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: '美しい風景, masterpiece, 最高品質 🌸',
        negativePrompt: '低解像度, 悪い',
        width: 512,
        height: 512,
      };

      const writeResult = writeAsWebUI(png, metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = read(writeResult.value);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      expect(readResult.metadata.prompt).toBe(
        '美しい風景, masterpiece, 最高品質 🌸',
      );
      // Negative prompt may include Size if it has no other content
      expect(readResult.metadata.negativePrompt).toContain('低解像度, 悪い');
    });

    it('should handle multiline prompts correctly', () => {
      const png = createMinimalPng();
      const metadata: StandardMetadata = {
        software: 'sd-webui',
        prompt: 'line1\\nline2\\nline3',
        negativePrompt: 'neg1\\nneg2',
        width: 512,
        height: 512,
      };

      const writeResult = writeAsWebUI(png, metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = read(writeResult.value);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      // Line endings should be normalized to \\n
      expect(readResult.metadata.prompt).toContain('line1');
      expect(readResult.metadata.prompt).toContain('line2');
      expect(readResult.metadata.prompt).toContain('line3');
    });
  });

  describe('real-world sample conversion', () => {
    it('should convert real SwarmUI sample to WebUI format', () => {
      const swarmPng = loadSample('png', 'swarmui.png');
      const readResult = read(swarmPng);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      const jpegBase = createMinimalJpeg();

      const writeResult = writeAsWebUI(jpegBase, readResult.metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const jpegRead = read(writeResult.value);
      expect(jpegRead.status).toBe('success');
      if (jpegRead.status !== 'success') return;

      expect(jpegRead.metadata.software).toBe('sd-webui');
      expect(jpegRead.metadata.prompt).toBeTruthy();
      expect(jpegRead.metadata.width).toBeGreaterThan(0);
    });

    it('should convert real InvokeAI sample to WebUI format', () => {
      const invokeaiPng = loadSample('png', 'invokeai.png');
      const readResult = read(invokeaiPng);
      expect(readResult.status).toBe('success');
      if (readResult.status !== 'success') return;

      const webpBase = createMinimalWebp();

      const writeResult = writeAsWebUI(webpBase, readResult.metadata);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const webpRead = read(writeResult.value);
      expect(webpRead.status).toBe('success');
      if (webpRead.status !== 'success') return;

      expect(webpRead.metadata.software).toBe('sd-webui');
      expect(webpRead.metadata.prompt).toBeTruthy();
    });
  });
});
