import type { LoraSettings, StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { lora, optionalLoras, toWeight } from '../utils/lora';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import type { InternalParseResult } from './types';

/**
 * Ruined Fooocus JSON metadata structure
 *
 * Ruined Fooocus stores metadata as JSON in the `parameters` chunk.
 * It has a `software` field set to "RuinedFooocus" for identification.
 */
interface RuinedFooocusJsonMetadata {
  Prompt?: string;
  Negative?: string;
  steps?: number;
  cfg?: number;
  width?: number;
  height?: number;
  seed?: number | string;
  sampler_name?: string;
  scheduler?: string;
  base_model_name?: string;
  /** Upper-case sha256, or null when the file has not been hashed */
  base_model_hash?: string | null;
  /**
   * LoRAs as `[hash, "weight - path"]` lists: the hash is an upper-case
   * sha256 or "" when the file has not been hashed, the text joins the
   * weight and the path below the LoRA folder with " - "
   */
  loras?: unknown[];
  clip_skip?: number;
  software?: string;
}

/** Separator between weight and path in a `loras` entry */
const LORA_SEPARATOR = ' - ';

/**
 * Read the `loras` list
 *
 * The name is the path part exactly as written (folder and extension
 * included); the weight is the number before the separator. Entries whose
 * text is missing are skipped, blank hashes are left out.
 *
 * @param entries - `loras` value
 * @returns LoRAs in slot order
 */
function extractLoras(entries: unknown): LoraSettings[] {
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    if (!Array.isArray(entry)) return [];
    const [hash, text] = entry;
    if (typeof text !== 'string') return [];

    const separator = text.indexOf(LORA_SEPARATOR);
    const name = (
      separator < 0 ? text : text.slice(separator + LORA_SEPARATOR.length)
    ).trim();
    if (name === '') return [];

    return [
      lora({
        name,
        weight: separator < 0 ? undefined : toWeight(text.slice(0, separator)),
        hash: typeof hash === 'string' && hash !== '' ? hash : undefined,
      }),
    ];
  });
}

/**
 * Parse Ruined Fooocus metadata from entries
 *
 * Ruined Fooocus stores metadata as JSON in the `parameters` chunk,
 * with a `software` field set to "RuinedFooocus".
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseRuinedFooocus(entries: EntryRecord): InternalParseResult {
  // Find JSON in parameters entry
  // PNG: stored in 'parameters' chunk
  // JPEG/WebP (after conversion): stored in 'UserComment' (from exifUserComment)
  const jsonText = entries.parameters ?? entries.UserComment;

  if (!jsonText?.startsWith('{')) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  const parsed = parseJson<RuinedFooocusJsonMetadata>(jsonText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Ruined Fooocus metadata',
    });
  }
  const json = parsed.value;
  const loras = extractLoras(json.loras);

  const metadata: Omit<StandardMetadata, 'raw'> = {
    software: 'ruined-fooocus',
    prompt: json.Prompt?.trim() ?? '',
    negativePrompt: json.Negative?.trim() ?? '',
    width: json.width ?? 0,
    height: json.height ?? 0,
    model: trimObject({
      name: json.base_model_name,
      hash: json.base_model_hash ?? undefined,
    }),
    sampling: trimObject({
      sampler: json.sampler_name,
      scheduler: json.scheduler,
      steps: json.steps,
      cfg: json.cfg,
      seed: toSeedString(json.seed),
      clipSkip: json.clip_skip,
    }),
    ...optionalLoras(loras),
  };

  return Result.ok(metadata);
}
