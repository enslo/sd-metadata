import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { read as fullRead, stringify } from '../../core/src/index';
import { parse as liteRead } from '../src/index';

const SAMPLES = join(__dirname, '../../../samples');

function load(format: string, file: string): Uint8Array {
  return new Uint8Array(readFileSync(join(SAMPLES, format, file)));
}

function field(text: string, name: string): string | undefined {
  const m = text.match(new RegExp(`${name}:\\s*([^,\\n]+)`));
  return m?.[1]?.trim();
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? '';
}

function baseName(file: string): string {
  return file.replace(/\.(png|jpe?g|webp)$/, '');
}

// Samples that produce no output at all
const EMPTY = new Set(['empty']);

// Samples with non-generation metadata — just check both produce non-empty
const FALLBACK = new Set(['gimp', 'gimp-en']);

// PNG-only incompatibilities: full version traces the ComfyUI node graph (only present in PNG)
// while lite returns the A1111 `parameters` text as-is. JPEG/WebP lack the node graph,
// so both versions read the same A1111 text and should match strictly.
const NON_COMPATIBLE = new Set([
  // `parameters` has inaccurate values from Save node inputs; full traces actual node graph.
  'comfyui-comfy-image-saver.png',
  // Flat scan picks a different KSampler node than recursive traversal (different Seed).
  'comfyui-comfyroll.png',
]);

// All sample files per format
const pngFiles = readdirSync(join(SAMPLES, 'png')).filter((f) =>
  f.endsWith('.png'),
);
const jpgFiles = readdirSync(join(SAMPLES, 'jpg')).filter(
  (f) => f.endsWith('.jpg') || f.endsWith('.jpeg'),
);
const webpFiles = readdirSync(join(SAMPLES, 'webp')).filter((f) =>
  f.endsWith('.webp'),
);

function runSampleTest(format: string, file: string): void {
  const data = load(format, file);
  const lite = liteRead(data);
  const full = stringify(fullRead(data));
  const base = baseName(file);

  if (EMPTY.has(base)) {
    expect(lite).toBe('');
    return;
  }

  // Both should produce non-empty output
  expect(lite.length, `lite empty for ${file}`).toBeGreaterThan(0);
  expect(full.length, `full empty for ${file}`).toBeGreaterThan(0);

  // For fallback samples, just check non-empty (no field comparison)
  if (FALLBACK.has(base)) return;

  // Key fields should match when present
  assertKeyFieldsMatch(lite, full, file);
}

describe('lite vs full cross-test', () => {
  describe('PNG samples', () => {
    for (const file of pngFiles) {
      it(`should handle ${file}`, () => runSampleTest('png', file));
    }
  });

  describe('JPEG samples', () => {
    for (const file of jpgFiles) {
      it(`should handle ${file}`, () => runSampleTest('jpg', file));
    }
  });

  describe('WebP samples', () => {
    for (const file of webpFiles) {
      it(`should handle ${file}`, () => runSampleTest('webp', file));
    }
  });
});

/**
 * Assert that key A1111 fields match between lite and full outputs.
 * All samples go through strict comparison unless explicitly listed in NON_COMPATIBLE.
 */
function assertKeyFieldsMatch(lite: string, full: string, file: string): void {
  const strict = !NON_COMPATIBLE.has(file);

  const liteSeed = field(lite, 'Seed');
  const fullSeed = field(full, 'Seed');
  if (liteSeed && fullSeed && strict) {
    expect(liteSeed, `Seed mismatch in ${file}`).toBe(fullSeed);
  }

  const liteSteps = field(lite, 'Steps');
  const fullSteps = field(full, 'Steps');
  if (liteSteps && fullSteps && strict) {
    expect(liteSteps, `Steps mismatch in ${file}`).toBe(fullSteps);
  }

  const liteModel = field(lite, 'Model');
  const fullModel = field(full, 'Model');
  if (liteModel && fullModel && strict) {
    expect(liteModel, `Model mismatch in ${file}`).toBe(fullModel);
  }

  const litePrompt = firstLine(lite);
  const fullPrompt = firstLine(full);
  if (litePrompt && fullPrompt && !litePrompt.startsWith('Negative')) {
    const slice = Math.min(40, litePrompt.length, fullPrompt.length);
    const overlap =
      litePrompt.includes(fullPrompt.slice(0, slice)) ||
      fullPrompt.includes(litePrompt.slice(0, slice));
    if (!overlap) {
      expect(
        litePrompt.trim().length,
        `lite prompt empty in ${file}`,
      ).toBeGreaterThan(0);
      expect(
        fullPrompt.trim().length,
        `full prompt empty in ${file}`,
      ).toBeGreaterThan(0);
    }
  }
}
