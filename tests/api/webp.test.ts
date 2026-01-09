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
  it('should parse NovelAI WebP in one step', () => {
    const data = loadSample('novelai-curated.webp');
    const result = parseWebp(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('novelai');
      expect(result.value.prompt).toBeTruthy();
      expect(result.value.raw.format).toBe('webp');
    }
  });

  it('should parse Forge Neo WebP in one step', () => {
    const data = loadSample('forge-neo.webp');
    const result = parseWebp(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('forge-neo');
      expect(result.value.prompt).toBeTruthy();
    }
  });

  it('should parse SwarmUI WebP in one step', () => {
    const data = loadSample('swarmui.webp');
    const result = parseWebp(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('swarmui');
      expect(result.value.prompt).toBeTruthy();
    }
  });

  it('should return error for invalid WebP', () => {
    const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = parseWebp(data);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('parseError');
      if (result.error.type === 'parseError') {
        expect(result.error.message).toBe('Not a valid WebP file');
      }
    }
  });

  // Regression tests for ComfyUI variants
  describe('ComfyUI variant support', () => {
    it('should parse comfyui-comfy-image-saver WebP (A1111 format)', () => {
      const data = loadSample('comfyui-comfy-image-saver.webp');
      const result = parseWebp(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Uses A1111 format with Version: ComfyUI, falls back to sd-webui
        expect(result.value.software).toBe('sd-webui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-save-image-extended WebP', () => {
      const data = loadSample('comfyui-save-image-extended.webp');
      const result = parseWebp(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-saveimage-plus WebP', () => {
      const data = loadSample('comfyui-saveimage-plus.webp');
      const result = parseWebp(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.prompt).toBeTruthy();
      }
    });
  });
});
