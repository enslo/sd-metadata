import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRuinedFooocus } from '../../src/parsers/ruined-fooocus';
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
  return result.value;
}

describe('parseRuinedFooocus', () => {
  it('should parse ruined-fooocus.png with Japanese text', () => {
    const chunks = loadChunks('ruined-fooocus.png');
    const result = parseRuinedFooocus(chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.software).toBe('ruined-fooocus');
    expect(result.value.prompt).toContain('hatsune miku');
    expect(result.value.width).toBe(1024);
    expect(result.value.height).toBe(1024);

    // Verify Japanese text is correctly extracted
    expect(result.value.prompt).toContain('#テスト');

    // Negative prompt
    expect(result.value.negativePrompt).toContain('bad quality');

    // Model settings
    expect(result.value.model).toBeDefined();
    expect(result.value.model?.name).toBe(
      'waiNSFWIllustrious_v150.safetensors',
    );
    expect(result.value.model?.hash).toBeDefined();

    // Sampling settings
    expect(result.value.sampling).toBeDefined();
    expect(result.value.sampling?.steps).toBe(30);
    expect(result.value.sampling?.cfg).toBe(8);
    expect(result.value.sampling?.seed).toBe(2020047614);
    expect(result.value.sampling?.sampler).toBe('dpmpp_2m_sde_gpu');
    expect(result.value.sampling?.scheduler).toBe('karras');
    expect(result.value.sampling?.clipSkip).toBe(1);
  });

  it('should return error for non-Ruined Fooocus format', () => {
    const chunks = loadChunks('comfyui.png');
    const result = parseRuinedFooocus(chunks);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('unsupportedFormat');
  });
});
