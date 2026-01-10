import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTensorArt } from '../../../src/parsers/tensorart';
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

describe('parseTensorArt', () => {
  it('should parse tensorart.png with Japanese text', () => {
    const chunks = loadChunks('tensorart.png');
    const result = parseTensorArt(chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('tensorart');
    expect(result.value.prompt).toContain('hatsune miku');
    expect(result.value.negativePrompt).toContain('bad quality');
    expect(result.value.width).toBe(1024);
    expect(result.value.height).toBe(1024);

    // Verify Japanese text is correctly extracted (Latin-1 → UTF-8 fixed)
    expect(result.value.prompt).toContain('#テスト');

    // Model settings
    expect(result.value.model).toBeDefined();

    // Sampling settings
    expect(result.value.sampling).toBeDefined();
    expect(result.value.sampling?.steps).toBe(25);
    expect(result.value.sampling?.cfg).toBe(7);
    expect(result.value.sampling?.clipSkip).toBe(2);
  });

  it('should return error for non-TensorArt format', () => {
    const chunks = loadChunks('novelai-full.png');
    const result = parseTensorArt(chunks);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('unsupportedFormat');
  });
});
