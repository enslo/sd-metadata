import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNovelAI } from '../../../src/parsers/novelai';
import { readPngMetadata } from '../../../src/readers/png';

const SAMPLES_DIR = join(__dirname, '../../../samples/png');

/**
 * Load sample and extract chunks
 */
function loadChunks(filename: string) {
  const path = join(SAMPLES_DIR, filename);
  const data = new Uint8Array(readFileSync(path));
  const result = readPngMetadata(data);
  if (!result.ok) throw new Error(`Failed to read ${filename}`);
  return result.value;
}

describe('parseNovelAI', () => {
  it('should parse novelai-full.png with Japanese text', () => {
    const chunks = loadChunks('novelai-full.png');
    const result = parseNovelAI(chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('novelai');
    expect(result.value.prompt).toContain('hatsune miku');
    expect(result.value.width).toBe(832);
    expect(result.value.height).toBe(1216);

    // Verify Japanese text is correctly extracted
    expect(result.value.prompt).toContain('#テスト');

    // Sampling settings
    expect(result.value.sampling).toBeDefined();
    expect(result.value.sampling?.steps).toBe(28);
    expect(result.value.sampling?.cfg).toBe(5.0);
    expect(result.value.sampling?.seed).toBe(2043807047);
    expect(result.value.sampling?.scheduler).toBe('karras');
  });

  it('should parse novelai-curated.png with Japanese text', () => {
    const chunks = loadChunks('novelai-curated.png');
    const result = parseNovelAI(chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('novelai');
    expect(result.value.prompt).toBeDefined();

    // Verify Japanese text is correctly extracted
    expect(result.value.prompt).toContain('#テスト');
  });

  it('should return error for non-NovelAI format', () => {
    const chunks = loadChunks('comfyui.png');
    const result = parseNovelAI(chunks);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('unsupportedFormat');
  });

  it('should parse V4 character prompts from novelai-full-3char.png with Japanese text', () => {
    const chunks = loadChunks('novelai-full-3char.png');
    const result = parseNovelAI(chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('novelai');

    // Verify Japanese text is correctly extracted from base prompt
    expect(result.value.prompt).toContain('#テスト');

    // Type narrow to NovelAIMetadata
    if (result.value.software !== 'novelai') return;

    // V4 character prompts
    expect(result.value.characterPrompts).toBeDefined();
    expect(result.value.characterPrompts?.length).toBe(3);

    // Check first character (Hatsune Miku)
    const miku = result.value.characterPrompts?.[0];
    expect(miku?.prompt).toContain('hatsune miku');
    expect(miku?.center).toEqual({ x: 0.5, y: 0.3 });

    // Check coords/order settings
    expect(result.value.useCoords).toBe(true);
    expect(result.value.useOrder).toBe(true);
  });
});
