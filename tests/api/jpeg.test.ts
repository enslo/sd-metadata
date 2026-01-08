import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseJpeg } from '../../src/api/jpeg';

const SAMPLES_DIR = join(__dirname, '../../samples/jpg');

/**
 * Load sample JPEG file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

describe('parseJpeg', () => {
  it('should parse metadata from civitai.jpeg', () => {
    const data = loadSample('civitai.jpeg');
    const result = parseJpeg(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // A1111 parser returns 'sd-webui' for Civitai
      expect(result.value.software).toBe('sd-webui');
      expect(result.value.prompt).toBeDefined();
    }
  });

  it('should parse metadata from forge-neo.jpeg', () => {
    const data = loadSample('forge-neo.jpeg');
    const result = parseJpeg(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('forge-neo');
    }
  });

  it('should parse metadata from comfyui-saveimage-plus.jpg', () => {
    const data = loadSample('comfyui-saveimage-plus.jpg');
    const result = parseJpeg(data);

    // ComfyUI JSON format - should parse as comfyui
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('comfyui');
    }
  });

  it('should parse metadata from swarmui.jpg', () => {
    const data = loadSample('swarmui.jpg');
    const result = parseJpeg(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('swarmui');
    }
  });

  it('should return error for invalid JPEG', () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const result = parseJpeg(data);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('parseError');
    }
  });
});
