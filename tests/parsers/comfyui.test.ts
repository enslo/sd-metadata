import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseComfyUI } from '../../src/parsers/comfyui';
import { readPngMetadata } from '../../src/readers/png';

const SAMPLES_DIR = join(__dirname, '../../samples/png');

/**
 * Load sample and extract chunks
 */
function loadChunks(filename: string) {
  const path = join(SAMPLES_DIR, filename);
  const data = new Uint8Array(readFileSync(path));
  const result = readPngMetadata(data);
  if (!result.ok) throw new Error(`Failed to read ${filename}`);
  return result.value.chunks;
}

describe('parseComfyUI', () => {
  it('should parse comfyui.png with Japanese text', () => {
    const chunks = loadChunks('comfyui.png');
    const result = parseComfyUI(chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('comfyui');
    expect(result.value.prompt).toBeDefined();
    expect(result.value.width).toBeGreaterThan(0);
    expect(result.value.height).toBeGreaterThan(0);

    // Verify Japanese text is correctly extracted
    expect(result.value.prompt).toContain('テスト');

    // Model settings
    expect(result.value.model).toBeDefined();
    expect(result.value.model?.name).toContain('.safetensors');

    // Sampling settings
    expect(result.value.sampling).toBeDefined();
    expect(result.value.sampling?.sampler).toBeDefined();
  });

  it('should parse comfyui-hires.png', () => {
    const chunks = loadChunks('comfyui-hires.png');
    const result = parseComfyUI(chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('comfyui');
  });

  it('should return error for non-ComfyUI format', () => {
    const chunks = loadChunks('novelai-full.png');
    const result = parseComfyUI(chunks);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('unsupportedFormat');
  });
});
