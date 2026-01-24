import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, write } from '../../src/index';

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

describe('Format conversion accuracy', () => {
  describe('PNG → JPEG conversion', () => {
    it('should preserve NovelAI metadata', () => {
      const pngData = loadSample('png', 'novelai-full.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'civitai.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      // Verify key fields are preserved
      expect(convertedRead.metadata.software).toBe('novelai');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
      expect(convertedRead.metadata.width).toBe(parseResult.metadata.width);
      expect(convertedRead.metadata.height).toBe(parseResult.metadata.height);
    });

    it('should preserve A1111 metadata', () => {
      const pngData = loadSample('png', 'forge.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'civitai.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('forge');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });

    it('should preserve ComfyUI metadata', () => {
      const pngData = loadSample('png', 'comfyui.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'civitai.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('comfyui');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
      expect(convertedRead.metadata.negativePrompt).toBe(
        parseResult.metadata.negativePrompt,
      );
    });

    it('should preserve InvokeAI metadata', () => {
      const pngData = loadSample('png', 'invokeai.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'civitai.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('invokeai');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });

    it('should preserve SwarmUI metadata', () => {
      const pngData = loadSample('png', 'swarmui-hires.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'civitai.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('swarmui');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });

    it('should preserve HF-Space metadata', () => {
      const pngData = loadSample('png', 'huggingface-animagine.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'civitai.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('hf-space');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });

    it('should preserve Ruined Fooocus metadata', () => {
      const pngData = loadSample('png', 'ruined-fooocus.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'civitai.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('ruined-fooocus');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });
  });

  describe('PNG → WebP conversion', () => {
    it('should preserve NovelAI metadata', () => {
      const pngData = loadSample('png', 'novelai-full.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const webpBase = loadSample('webp', 'forge-hires.webp');
      const converted = write(webpBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('novelai');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });

    it('should preserve ComfyUI metadata', () => {
      const pngData = loadSample('png', 'comfyui.png');
      const parseResult = read(pngData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const webpBase = loadSample('webp', 'forge-hires.webp');
      const converted = write(webpBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('comfyui');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });
  });

  describe('JPEG → PNG conversion', () => {
    it('should preserve A1111 metadata', () => {
      const jpegData = loadSample('jpg', 'forge.jpeg');
      const parseResult = read(jpegData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const pngBase = loadSample('png', 'forge.png');
      const converted = write(pngBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('forge');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });

    it('should preserve ComfyUI metadata', () => {
      const jpegData = loadSample('jpg', 'comfyui-saveimage-plus.jpg');
      const parseResult = read(jpegData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const pngBase = loadSample('png', 'comfyui.png');
      const converted = write(pngBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('comfyui');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });
  });

  describe('JPEG → WebP conversion', () => {
    it('should preserve metadata through segment copy', () => {
      const jpegData = loadSample('jpg', 'forge.jpeg');
      const parseResult = read(jpegData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const webpBase = loadSample('webp', 'forge-hires.webp');
      const converted = write(webpBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('forge');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });
  });

  describe('WebP → PNG conversion', () => {
    it('should preserve ComfyUI metadata', () => {
      const webpData = loadSample('webp', 'comfyui-saveimage-plus.webp');
      const parseResult = read(webpData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const pngBase = loadSample('png', 'comfyui.png');
      const converted = write(pngBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('comfyui');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });
  });

  describe('WebP → JPEG conversion', () => {
    it('should preserve metadata through segment copy', () => {
      const webpData = loadSample('webp', 'forge-hires.webp');
      const parseResult = read(webpData);
      expect(parseResult.status).toBe('success');
      if (parseResult.status !== 'success') return;

      const jpegBase = loadSample('jpg', 'forge.jpeg');
      const converted = write(jpegBase, parseResult);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;

      const convertedRead = read(converted.value);
      expect(convertedRead.status).toBe('success');
      if (convertedRead.status !== 'success') return;

      expect(convertedRead.metadata.software).toBe('forge');
      expect(convertedRead.metadata.prompt).toBe(parseResult.metadata.prompt);
    });
  });
});
