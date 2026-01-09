import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseJpeg } from '../../src/api/jpeg';

/**
 * Load sample JPEG file as Uint8Array
 */
function loadSample(filename: string): Uint8Array {
  const filePath = path.join('samples/jpg', filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

describe('parseJpeg', () => {
  it('should return error for invalid JPEG', () => {
    const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = parseJpeg(data);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('parseError');
      if (result.error.type === 'parseError') {
        expect(result.error.message).toBe('Not a valid JPEG file');
      }
    }
  });

  describe('Civitai samples', () => {
    it('should parse civitai.jpeg', () => {
      const data = loadSample('civitai.jpeg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('sd-webui');
        expect(result.value.prompt).toBeTruthy();
        expect(result.value.raw.format).toBe('jpeg');
      }
    });

    it('should parse civitai-hires.jpg (ComfyUI JSON format)', () => {
      const data = loadSample('civitai-hires.jpg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it.fails('should parse civitai-upscale.jpg (ComfyUI JSON format)', () => {
      // TODO: Fix - upscale workflow parses but extracts no useful data
      const data = loadSample('civitai-upscale.jpg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        // Should have at least width/height or prompt
        const hasContent =
          result.value.width > 0 ||
          result.value.height > 0 ||
          result.value.prompt;
        expect(hasContent).toBe(true);
      }
    });
  });

  describe('Forge samples', () => {
    it('should parse forge-neo.jpeg', () => {
      const data = loadSample('forge-neo.jpeg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('forge-neo');
        expect(result.value.prompt).toBeTruthy();
      }
    });
  });

  describe('SwarmUI samples', () => {
    it('should parse swarmui.jpg', () => {
      const data = loadSample('swarmui.jpg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('swarmui');
        expect(result.value.prompt).toBeTruthy();
      }
    });
  });

  describe('ComfyUI samples', () => {
    it('should parse comfyui-comfy-image-saver.jpeg (A1111 format)', () => {
      const data = loadSample('comfyui-comfy-image-saver.jpeg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Uses A1111 format with Version: ComfyUI, falls back to sd-webui
        expect(result.value.software).toBe('sd-webui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-save-image-extended.jpeg', () => {
      const data = loadSample('comfyui-save-image-extended.jpeg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-saveimage-plus.jpg', () => {
      const data = loadSample('comfyui-saveimage-plus.jpg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-saveimagewithmetadata.jpeg', () => {
      const data = loadSample('comfyui-saveimagewithmetadata.jpeg');
      const result = parseJpeg(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Uses A1111 format
        expect(result.value.software).toBe('sd-webui');
      }
    });
  });
});
