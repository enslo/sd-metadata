import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWebp } from '../../src/api/webp';

const SAMPLES_DIR = join(__dirname, '../../samples/webp');

/**
 * Load sample WebP file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

describe('parseWebp', () => {
  it('should parse metadata from forge-neo.webp', () => {
    const data = loadSample('forge-neo.webp');
    const result = parseWebp(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('forge-neo');
    }
  });

  it('should parse metadata from comfyui-saveimage-plus.webp', () => {
    const data = loadSample('comfyui-saveimage-plus.webp');
    const result = parseWebp(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('comfyui');
    }
  });

  it('should parse metadata from swarmui.webp', () => {
    const data = loadSample('swarmui.webp');
    const result = parseWebp(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('swarmui');
    }
  });

  it('should parse metadata from novelai-curated.webp', () => {
    const data = loadSample('novelai-curated.webp');
    const result = parseWebp(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('novelai');
    }
  });

  it('should return error for invalid WebP', () => {
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const result = parseWebp(data);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('parseError');
    }
  });
});
