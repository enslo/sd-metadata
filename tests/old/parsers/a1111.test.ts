import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseA1111 } from '../../../src/parsers/a1111';
import { readPngMetadata } from '../../../src/readers/png';
import { pngChunksToEntries } from '../../../src/utils/convert';

const SAMPLES_DIR = join(__dirname, '../../../samples/png');

/**
 * Load sample and extract entries
 */
function loadEntries(filename: string) {
  const path = join(SAMPLES_DIR, filename);
  const data = new Uint8Array(readFileSync(path));
  const result = readPngMetadata(data);
  if (!result.ok) throw new Error(`Failed to read ${filename}`);
  return pngChunksToEntries(result.value);
}

describe('parseA1111', () => {
  it('should parse forge-neo.png with Japanese text', () => {
    const entries = loadEntries('forge-neo.png');
    const result = parseA1111(entries);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('forge-neo');
    expect(result.value.prompt).toContain('hatsune miku');
    expect(result.value.negativePrompt).toContain('bad quality');
    expect(result.value.width).toBe(1024);
    expect(result.value.height).toBe(1024);

    // Verify Japanese text is correctly extracted
    expect(result.value.prompt).toContain('テスト');

    // Model settings
    expect(result.value.model).toBeDefined();
    expect(result.value.model?.name).toBe('waiIllustriousSDXL_v160');
    expect(result.value.model?.hash).toBe('45a21ea00a');

    // Sampling settings
    expect(result.value.sampling).toBeDefined();
    expect(result.value.sampling?.sampler).toBe('Euler a');
    expect(result.value.sampling?.scheduler).toBe('Automatic');
    expect(result.value.sampling?.steps).toBe(24);
    expect(result.value.sampling?.cfg).toBe(6);
    expect(result.value.sampling?.seed).toBe(4179307297);
    expect(result.value.sampling?.clipSkip).toBe(2);
  });

  it('should parse forge-neo-hires.png with hires settings', () => {
    const entries = loadEntries('forge-neo-hires.png');
    const result = parseA1111(entries);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('forge-neo');

    // Hires settings
    expect(result.value.hires).toBeDefined();
    expect(result.value.hires?.scale).toBe(1.5);
    expect(result.value.hires?.upscaler).toBe('ESRGAN');
    expect(result.value.hires?.steps).toBe(10);
    expect(result.value.hires?.denoise).toBe(0.3);
  });

  it('should parse civitai.png', () => {
    const entries = loadEntries('civitai.png');
    const result = parseA1111(entries);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Civitai uses A1111 format but may not have version
    expect(['sd-webui', 'forge', 'forge-neo']).toContain(result.value.software);
    expect(result.value.prompt).toContain('hatsune miku');
    expect(result.value.width).toBe(1024);
    expect(result.value.height).toBe(1360);
  });

  it('should parse NovelAI format with no settings section', () => {
    const entries = loadEntries('novelai-full.png');
    const result = parseA1111(entries);

    // NovelAI has 'Comment' chunk but no "Steps:" marker
    // Parser treats it as A1111 format with no settings section (width=0, height=0)
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.width).toBe(0);
    expect(result.value.height).toBe(0);
  });
});
