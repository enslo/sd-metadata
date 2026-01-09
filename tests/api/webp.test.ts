import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWebp } from '../../src/api/webp';

/**
 * Load sample WebP file as Uint8Array
 */
function loadSample(filename: string): Uint8Array {
  const filePath = path.join('samples/webp', filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

describe('parseWebp', () => {
  it('should return invalid for corrupted WebP', () => {
    const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = parseWebp(data);

    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.message).toBe('Not a valid WebP file');
    }
  });

  describe('NovelAI samples', () => {
    it('should parse novelai-curated.webp', () => {
      const data = loadSample('novelai-curated.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        expect(result.metadata.software).toBe('novelai');
        expect(result.metadata.prompt).toBeTruthy();
        expect(result.raw.format).toBe('webp');
      }
    });

    it('should parse novelai-full-3char.webp', () => {
      const data = loadSample('novelai-full-3char.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        expect(result.metadata.software).toBe('novelai');
        expect(result.metadata.prompt).toBeTruthy();
      }
    });
  });

  describe('Forge samples', () => {
    it('should parse forge-neo.webp', () => {
      const data = loadSample('forge-neo.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        expect(result.metadata.software).toBe('forge-neo');
        expect(result.metadata.prompt).toBeTruthy();
      }
    });
  });

  describe('SwarmUI samples', () => {
    it('should parse swarmui.webp', () => {
      const data = loadSample('swarmui.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        expect(result.metadata.software).toBe('swarmui');
        expect(result.metadata.prompt).toBeTruthy();
      }
    });
  });

  describe('ComfyUI samples', () => {
    it('should parse comfyui-comfy-image-saver.webp (A1111 format)', () => {
      const data = loadSample('comfyui-comfy-image-saver.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        // Uses A1111 format with Version: ComfyUI, falls back to sd-webui
        expect(result.metadata.software).toBe('sd-webui');
        expect(result.metadata.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-save-image-extended.webp', () => {
      const data = loadSample('comfyui-save-image-extended.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        expect(result.metadata.software).toBe('comfyui');
        expect(result.metadata.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-saveimage-plus.webp', () => {
      const data = loadSample('comfyui-saveimage-plus.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        expect(result.metadata.software).toBe('comfyui');
        expect(result.metadata.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-saveimagewithmetadata.webp', () => {
      const data = loadSample('comfyui-saveimagewithmetadata.webp');
      const result = parseWebp(data);

      expect(result.status === 'success').toBe(true);
      if (result.status === 'success') {
        // Uses A1111 format
        expect(result.metadata.software).toBe('sd-webui');
      }
    });
  });
});
