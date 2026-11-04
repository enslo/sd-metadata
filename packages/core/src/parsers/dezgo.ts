import type { LoraSettings, StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { lora, optionalLoras, toWeight } from '../utils/lora';
import { toNumber } from '../utils/number';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import { parseYamlMapping } from '../utils/yaml';
import type { InternalParseResult } from './types';

/**
 * Request fields of a Dezgo job
 *
 * Field names follow the Dezgo API (dev.dezgo.com/openapi.json). The JSON
 * record holds typed values; the YAML record holds the same values as text.
 */
type DezgoInput = Record<string, unknown>;

/** LoRA slots of the Dezgo API: lora1 to lora4, each with a strength */
const LORA_SLOTS = [1, 2, 3, 4] as const;

/**
 * Parse Dezgo metadata from entries
 *
 * Dezgo writes one job record, `{ JobId, Function, Input }`:
 * - PNG: JSON in the `GenInfo` chunk, and the same record as YAML in the
 *   EXIF UserComment of an `eXIf` chunk
 * - JPEG/WebP: YAML in the EXIF UserComment
 *
 * The JSON is read when present; otherwise the YAML.
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseDezgo(entries: EntryRecord): InternalParseResult {
  const input = readInput(entries);
  if (!input) {
    return Result.error({
      type: 'parseError',
      message: 'Missing Dezgo job input',
    });
  }

  const metadata: Omit<StandardMetadata, 'raw'> = {
    software: 'dezgo',
    prompt: toText(input.prompt) ?? '',
    negativePrompt: toText(input.negative_prompt) ?? '',
    width: toNumber(input.width) ?? 0,
    height: toNumber(input.height) ?? 0,
    model: trimObject({ name: toText(input.model) }),
    sampling: trimObject({
      sampler: toText(input.sampler),
      steps: toNumber(input.steps),
      cfg: toNumber(input.guidance),
      seed: toSeedString(input.seed),
      // image2image only
      denoise: toNumber(input.strength),
    }),
    ...optionalLoras(readLoras(input)),
  };

  return Result.ok(metadata);
}

/**
 * Find the job's Input record, from the GenInfo JSON or the YAML
 */
function readInput(entries: EntryRecord): DezgoInput | undefined {
  if (entries.GenInfo !== undefined) {
    const parsed = parseJson(entries.GenInfo);
    if (parsed.ok && parsed.type === 'object') {
      const input = parsed.value.Input;
      if (isRecord(input)) return input;
    }
  }

  const yaml = entries.UserComment && parseYamlMapping(entries.UserComment);
  const input = yaml ? yaml.Input : undefined;
  return isRecord(input) ? input : undefined;
}

/**
 * Read the LoRA slots
 *
 * The API takes each LoRA as the SHA-256 of a CivitAI model and records no
 * name, so the hash is also the name. A slot without a hash is unused, even
 * though its strength is always recorded.
 */
function readLoras(input: DezgoInput): LoraSettings[] {
  return LORA_SLOTS.flatMap((slot) => {
    const hash = toText(input[`lora${slot}`]);
    if (!hash) return [];
    return [
      lora({
        name: hash,
        hash,
        weight: toWeight(input[`lora${slot}_strength`]),
      }),
    ];
  });
}

function isRecord(value: unknown): value is DezgoInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Text of a JSON or YAML scalar */
function toText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}
