import type { LoraSettings, StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { lora, optionalLoras, toWeight } from '../utils/lora';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import type { InternalParseResult } from './types';

/**
 * Draw Things metadata parser
 *
 * Draw Things (iOS/macOS) stores metadata in XMP format inside a PNG iTXt
 * chunk. The XMP is expanded to standard entries by the convert layer:
 * - CreatorTool: "Draw Things"
 * - UserComment: JSON with structured generation parameters
 * - parameters: A1111-like text from dc:description (fallback)
 *
 * The JSON in UserComment uses these key fields:
 * - c: positive prompt
 * - uc: negative prompt (unconditional)
 * - model: model filename
 * - sampler: sampler name
 * - scale: guidance scale (CFG)
 * - seed: seed value
 * - steps: number of steps
 * - strength: denoising strength
 * - size: image size (e.g., "960x1280")
 * - v2: the configuration as saved by the app, with `loras[]`
 */

/**
 * `LoRA N Model: file, LoRA N Weight: w` pairs in the dc:description text
 */
const DESCRIPTION_LORA = /LoRA (\d+) Model: ([^,]+), LoRA \1 Weight: ([^,]+)/g;

/**
 * Parse Draw Things metadata from entries
 *
 * @param entries - Metadata entries (XMP-expanded by convert layer)
 * @returns Parsed metadata or error
 */
export function parseDrawThings(entries: EntryRecord): InternalParseResult {
  // Primary: JSON from UserComment or Comment (JPEG/WebP conversion cases)
  const jsonText = entries.UserComment?.startsWith('{')
    ? entries.UserComment
    : entries.Comment?.startsWith('{')
      ? entries.Comment
      : undefined;
  if (!jsonText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const parsed = parseJson<Record<string, unknown>>(jsonText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Draw Things metadata',
    });
  }

  return buildMetadata(parsed.value, entries.parameters);
}

/**
 * Parse image dimensions from "WxH" size string
 */
function parseSize(size: unknown): { width: number; height: number } {
  if (typeof size !== 'string') return { width: 0, height: 0 };
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return { width: 0, height: 0 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Plain-object check for nested JSON values
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the LoRA list
 *
 * Draw Things writes the LoRAs three times. `v2.loras[]` (`file`, `weight`,
 * `mode`) is the configuration as saved and is read first. The top-level
 * `lora[]` repeats it with float32 weights (`0.30000001192092896`) and is
 * skipped. Files without `v2` fall back to the A1111-like text of
 * dc:description (`LoRA 1 Model: file, LoRA 1 Weight: 0.3`), which the XMP
 * layer exposes as `parameters`.
 *
 * @param data - Parsed UserComment JSON
 * @param description - `parameters` entry (dc:description), if any
 * @returns LoRAs in slot order
 */
function extractLoras(
  data: Record<string, unknown>,
  description: string | undefined,
): LoraSettings[] {
  const v2 = data.v2;
  if (isRecord(v2) && Array.isArray(v2.loras)) {
    return v2.loras.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const name = entry.file;
      if (typeof name !== 'string' || name === '') return [];
      return [lora({ name, weight: toWeight(entry.weight) })];
    });
  }

  if (!description) return [];
  return [...description.matchAll(DESCRIPTION_LORA)].map((match) =>
    lora({ name: (match[2] ?? '').trim(), weight: toWeight(match[3]) }),
  );
}

/**
 * Build StandardMetadata from parsed Draw Things JSON
 *
 * @param data - Parsed UserComment JSON
 * @param description - `parameters` entry (dc:description), if any
 */
function buildMetadata(
  data: Record<string, unknown>,
  description: string | undefined,
): InternalParseResult {
  const str = (key: string): string | undefined => {
    const v = data[key];
    return typeof v === 'string' ? v : undefined;
  };
  const num = (key: string): number | undefined => {
    const v = data[key];
    if (typeof v === 'number' && v !== 0) return v;
    return undefined;
  };

  const prompt = (str('c') ?? '').trim();
  const negativePrompt = (str('uc') ?? '').trim();
  const { width, height } = parseSize(data.size);
  const loras = extractLoras(data, description);

  const metadata: StandardMetadata = {
    software: 'draw-things',
    prompt,
    negativePrompt,
    width,
    height,
    model: trimObject({
      name: str('model'),
    }),
    sampling: trimObject({
      sampler: str('sampler'),
      steps: num('steps'),
      cfg: num('scale'),
      // Seed 0 means unset (same rule as num()); otherwise keep the exact text
      seed: num('seed') === undefined ? undefined : toSeedString(data.seed),
      denoise: num('strength'),
    }),
    ...optionalLoras(loras),
  };

  return Result.ok(metadata);
}
