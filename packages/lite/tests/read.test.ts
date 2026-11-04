import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { read as fullRead, stringify } from '../../core/src/index';
import { parse as liteRead } from '../src/index';

const SAMPLES = join(import.meta.dirname, '../../../samples');

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

// Samples whose only metadata is an XMP packet (Draw Things): lite does not
// read XMP (Draw Things is deliberately out of lite's scope), so it must
// return '' while full parses the packet
const XMP_ONLY = new Set(['draw-things-lora']);

// Dezgo samples: the job record is YAML (PNG eXIf, JPEG/WebP UserComment),
// which lite does not parse (Dezgo is out of lite's scope, a YAML reader
// cost +329 bytes), so lite returns the record text as it is
const DEZGO_YAML = new Set(['dezgo', 'dezgo-lora', 'dezgo-long']);

// Samples with non-generation metadata — just check both produce non-empty
const FALLBACK = new Set(['gimp', 'gimp-en']);

// PNG-only incompatibilities: full version traces the ComfyUI node graph (only present in PNG)
// while lite returns the A1111 `parameters` text as-is. JPEG/WebP lack the node graph,
// so both versions read the same A1111 text and should match strictly.
const NON_COMPATIBLE = new Set([
  // `parameters` has inaccurate values from Save node inputs; full traces actual node graph.
  'comfyui-comfy-image-saver.png',
  // Same Image Saver node with embed_workflow on: UserComment holds its unwired
  // placeholder text (Seed 0); full reads the graph from Make/Model instead.
  'comfyui-comfy-image-saver-with-workflow.jpeg',
]);

// Seed-only differences: the flat scan takes the first sampler it meets, which
// in these ComfyRoll hires graphs is the second pass (its own seed), while
// full traces the main sampler, seeded by a CR Seed node. Steps, model and
// hires fields are still compared strictly.
const SEED_DIFFERS = new Set([
  'comfyui-comfyroll.png',
  'comfyui-comfyroll-lora.png',
]);

// All sample files per format
const pngFiles = readdirSync(join(SAMPLES, 'png')).filter((f: string) =>
  f.endsWith('.png'),
);
const jpgFiles = readdirSync(join(SAMPLES, 'jpg')).filter(
  (f: string) => f.endsWith('.jpg') || f.endsWith('.jpeg'),
);
const webpFiles = readdirSync(join(SAMPLES, 'webp')).filter((f: string) =>
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

  if (XMP_ONLY.has(base)) {
    expect(lite, `lite read XMP for ${file}`).toBe('');
    expect(full.length, `full empty for ${file}`).toBeGreaterThan(0);
    return;
  }

  if (DEZGO_YAML.has(base)) {
    expect(lite, `lite parsed Dezgo YAML for ${file}`).toMatch(
      /^\nJobId: .*\nFunction: .*\nInput:\n/,
    );
    expect(full, `full kept YAML for ${file}`).not.toContain('JobId');
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
  if (liteSeed && fullSeed && strict && !SEED_DIFFERS.has(file)) {
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

  for (const name of ['Hires upscale', 'Hires steps', 'Hires upscaler']) {
    const liteVal = field(lite, name);
    const fullVal = field(full, name);
    if (liteVal && fullVal && strict) {
      expect(liteVal, `${name} mismatch in ${file}`).toBe(fullVal);
    }
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

// Fooocus JSON scheme: both lite and core join `full_prompt` /
// `full_negative_prompt` (the style-resolved text Fooocus actually encoded)
// with ", ", so the prompt lines must match exactly, not just overlap.
// Lite does not write LoRAs (out of its scope), so core's text is rebuilt
// without them for the comparison.
describe('Fooocus JSON scheme resolved prompts', () => {
  it('should produce the same prompt lines as core for every container', () => {
    const files: Array<[string, string]> = [
      ['png', 'fooocus.png'],
      ['jpg', 'fooocus.jpg'],
      ['webp', 'fooocus.webp'],
    ];
    for (const [format, file] of files) {
      const data = load(format, file);
      const lite = liteRead(data).split('\n');
      const parsed = fullRead(data);
      if (parsed.status !== 'success')
        throw new Error(`${file}: ${parsed.status}`);
      // Core writes the three LoRAs as tags; lite leaves them out
      expect(stringify(parsed), file).toContain('<lora:');
      expect(lite.join('\n'), file).not.toContain('<lora:');
      const full = stringify({ ...parsed.metadata, loras: undefined }).split(
        '\n',
      );
      // Everything but the trailing settings line
      expect(lite.slice(0, -1), file).toEqual(full.slice(0, -1));
      // The style template, not the raw user prompt, must be present
      expect(lite[0], file).toContain('watercolor painting');
    }
  });
});

// Easy Diffusion PNG: `clip_skip` is the boolean "False"/"True", which core
// ignores; lite must not print it as a Clip skip value either.
describe('Easy Diffusion boolean clip_skip', () => {
  it('should not emit Clip skip for the PNG samples', () => {
    for (const file of ['easy-diffusion.png', 'easy-diffusion-lora.png']) {
      const data = load('png', file);
      expect(liteRead(data), file).not.toContain('Clip skip');
      expect(stringify(fullRead(data)), file).not.toContain('Clip skip');
    }
  });
});

// NovelAI: the V5 web client appends the quoted texts as ", teXt: ...",
// which both lite and core drop; an img2img request's strength is the
// Denoising strength; Source holds the model name and hash. The cross-test
// above only checks prompt overlap and skips a model lite leaves out, so
// the whole text is compared here. (The -3char samples are left out: core
// writes character prompts, lite does not.)
describe('NovelAI text block, img2img strength and model', () => {
  it('should produce the same text as core', () => {
    const files: Array<[string, string]> = [
      ['png', 'novelai-v3.png'],
      ['webp', 'novelai-v3.webp'],
      ['png', 'novelai-curated.png'],
      ['png', 'novelai-full.png'],
      ['webp', 'novelai-curated.webp'],
      ['png', 'novelai-v5-full.png'],
      ['webp', 'novelai-v5-full.webp'],
      ['png', 'novelai-v5-full-i2i.png'],
    ];
    for (const [format, file] of files) {
      const data = load(format, file);
      const lite = liteRead(data);
      expect(lite, file).not.toContain('teXt:');
      expect(lite, file).toContain('Model hash: ');
      expect(lite, file).toBe(stringify(fullRead(data)));
    }
    expect(liteRead(load('png', 'novelai-v5-full-i2i.png'))).toContain(
      'Denoising strength: 0.4',
    );
  });
});
