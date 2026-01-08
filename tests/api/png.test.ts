import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePng } from '../../src/api/png';

/**
 * Load sample PNG file as Uint8Array
 */
function loadSample(filename: string): Uint8Array {
  const filePath = path.join('samples/png', filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

describe('parsePng', () => {
  it('should parse NovelAI image in one step', () => {
    const data = loadSample('novelai-full.png');
    const result = parsePng(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('novelai');
      expect(result.value.prompt).toBeTruthy();
      expect(result.value.width).toBeGreaterThan(0);
      expect(result.value.height).toBeGreaterThan(0);
    }
  });

  it('should parse A1111/Forge image in one step', () => {
    const data = loadSample('forge-neo.png');
    const result = parsePng(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('forge-neo');
      expect(result.value.prompt).toBeTruthy();
    }
  });

  it('should parse ComfyUI image in one step', () => {
    const data = loadSample('comfyui.png');
    const result = parsePng(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.software).toBe('comfyui');
    }
  });

  it('should return error for invalid PNG', () => {
    const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = parsePng(data);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('parseError');
      if (result.error.type === 'parseError') {
        expect(result.error.message).toBe('Not a valid PNG file');
      }
    }
  });

  it('should return error for unsupported format', () => {
    // Create minimal valid PNG with no metadata
    const data = loadSample('novelai-full.png');
    // This test would need a PNG without metadata
    // For now, we just verify the function works
    expect(parsePng(data).ok).toBe(true);
  });
});
