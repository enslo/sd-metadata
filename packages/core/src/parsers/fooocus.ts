import type { LoraSettings, StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { lora, optionalLoras, toWeight } from '../utils/lora';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import type { InternalParseResult } from './types';

/**
 * Fooocus JSON metadata structure
 *
 * Fooocus offers two user-selectable metadata schemes (Advanced →
 * Developer Debug Mode → Save Metadata to Images → Metadata Scheme):
 * - `fooocus`: JSON (this parser)
 * - `a1111`: A1111-compatible text, handled by `parseA1111` with
 *   software `fooocus`
 *
 * The JSON scheme embeds the object in:
 * - PNG: `parameters` tEXt chunk (non-ASCII escaped), plus a
 *   `fooocus_scheme` tEXt chunk holding the scheme name
 * - JPEG/WebP: EXIF UserComment (0x9286); the scheme name goes to
 *   MakerNote (0x927C), which this library does not read, so the
 *   scheme is inferred from the UserComment content instead
 *
 * Verified against real Fooocus v2.5 output in `samples/`.
 */
interface FooocusJsonMetadata {
  /** Prompt as typed by the user (the a1111 scheme calls it "Raw prompt") */
  prompt?: string;
  /** Negative prompt as typed by the user */
  negative_prompt?: string;
  /**
   * Prompt actually encoded for generation
   *
   * Selected styles wrap the first prompt line in their template (adding
   * quality tags and style words), one entry per style; the remaining
   * prompt lines and the prompt-expansion result follow as further entries.
   * Fooocus's own a1111 scheme writes `', '.join(full_prompt)`.
   */
  full_prompt?: string[];
  /** Negative prompt actually encoded: one entry per style, then the user text */
  full_negative_prompt?: string[];
  resolution?: string;
  base_model?: string;
  base_model_hash?: string;
  vae?: string;
  sampler?: string;
  scheduler?: string;
  /** Written as a string by Fooocus (64-bit seeds); older builds may emit a number */
  seed?: number | string;
  guidance_scale?: number;
  steps?: number;
  clip_skip?: number;
  /**
   * LoRAs actually applied, one `[name, weight, hash]` list per entry (file
   * stem, number, 10-hex AutoV2 hash). The `lora_combined_N` keys repeat
   * the same data as text and are not read.
   */
  loras?: unknown[];
}

/**
 * Parse resolution string "(W, H)" into width and height
 *
 * Fooocus stores resolution as a Python tuple string, e.g., "(1024, 1024)".
 *
 * @param resolution - Resolution string in format "(width, height)"
 * @returns Parsed dimensions or { width: 0, height: 0 } on failure
 */
function parseResolution(resolution: string | undefined): {
  width: number;
  height: number;
} {
  if (!resolution) return { width: 0, height: 0 };

  const match = resolution.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!match?.[1] || !match[2]) return { width: 0, height: 0 };

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

/**
 * Join the resolved prompt parts the way Fooocus's a1111 scheme does
 *
 * Each entry of `full_prompt` / `full_negative_prompt` is encoded
 * separately by Fooocus; its A1111-style output joins them with ", ".
 * Non-string and blank entries are skipped.
 *
 * @param parts - `full_prompt` or `full_negative_prompt` value
 * @returns Joined text, or undefined when there is nothing to join
 */
function joinPromptParts(parts: unknown): string | undefined {
  if (!Array.isArray(parts)) return undefined;

  const text = parts
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .join(', ');

  return text === '' ? undefined : text;
}

/**
 * Read the `loras` list
 *
 * Fooocus writes only the LoRA slots that are enabled and not set to
 * "None", in slot order. Entries that are not a list starting with a name
 * are skipped; a missing or blank hash is left out.
 *
 * @param entries - `loras` value
 * @returns LoRAs in slot order
 */
function extractLoras(entries: unknown): LoraSettings[] {
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    if (!Array.isArray(entry)) return [];
    const [name, weight, hash] = entry;
    if (typeof name !== 'string' || name === '' || name === 'None') return [];
    return [
      lora({
        name,
        weight: toWeight(weight),
        hash: typeof hash === 'string' && hash !== '' ? hash : undefined,
      }),
    ];
  });
}

/**
 * Parse Fooocus JSON metadata from entries
 *
 * Reads from `parameters` (PNG) or `UserComment` (JPEG/WebP).
 *
 * Prompts come from `full_prompt` / `full_negative_prompt` because that is
 * the text the image was generated from (styles add quality tags and
 * templates); the raw `prompt` / `negative_prompt` are used only when the
 * resolved lists are missing or empty.
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseFooocus(entries: EntryRecord): InternalParseResult {
  const jsonText = entries.parameters ?? entries.UserComment;

  if (!jsonText?.startsWith('{')) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const parsed = parseJson<FooocusJsonMetadata>(jsonText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Fooocus metadata',
    });
  }
  const json = parsed.value;

  const { width, height } = parseResolution(json.resolution);
  const loras = extractLoras(json.loras);

  const metadata: StandardMetadata = {
    software: 'fooocus',
    prompt: joinPromptParts(json.full_prompt) ?? json.prompt?.trim() ?? '',
    negativePrompt:
      joinPromptParts(json.full_negative_prompt) ??
      json.negative_prompt?.trim() ??
      '',
    width,
    height,
    model: trimObject({
      name: json.base_model,
      hash: json.base_model_hash,
      vae: json.vae,
    }),
    sampling: trimObject({
      sampler: json.sampler,
      scheduler: json.scheduler,
      steps: json.steps,
      cfg: json.guidance_scale,
      seed: toSeedString(json.seed),
      clipSkip: json.clip_skip,
    }),
    ...optionalLoras(loras),
  };

  return Result.ok(metadata);
}
