/**
 * Unified metadata stringification
 *
 * Builds A1111-format plain text from metadata and provides the stringify()
 * public API for converting any metadata type to a human-readable string.
 */

import { originLabel } from '../constants';
import { A1111_SOFTWARE } from '../parsers/a1111';
import type {
  CharacterPrompt,
  EmbedMetadata,
  GenerationMetadata,
  GenerationSoftware,
  HiresSettings,
  ParseResult,
  RawMetadata,
  VideoParseResult,
  VideoRawMetadata,
} from '../types';
import {
  pngRawToRecord,
  segmentsToRecord,
  videoTagsToRecord,
} from '../utils/convert';
import {
  formatCivitaiResources,
  formatLoraHashes,
  injectLoraTags,
} from '../utils/lora';

/**
 * Metadata the text is built from
 *
 * GenerationMetadata fits EmbedMetadata structurally; `software` is read
 * when present to pick CivitAI's own LoRA notation.
 */
type TextMetadata = EmbedMetadata & { software?: GenerationSoftware };

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Normalize line endings to LF (\n)
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Quote a settings value the way A1111's infotext `quote()` does
 *
 * JSON-quoted when the value contains a comma, colon or newline (which
 * would otherwise break the `key: value, …` line), plain otherwise.
 */
function quoteValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return /[,:\n]/.test(value) ? JSON.stringify(value) : value;
}

/**
 * CivitAI's A1111-style text lists LoRAs in `Civitai resources`, not as tags
 */
function isCivitai(metadata: TextMetadata): boolean {
  return metadata.software === 'civitai';
}

/**
 * Build character prompts section
 *
 * Format: # Character N [x, y]:\n[prompt]
 */
function buildCharacterPromptsSection(
  characterPrompts: CharacterPrompt[],
): string[] {
  return characterPrompts.flatMap((cp, index) => {
    const coords = cp.center ? ` [${cp.center.x}, ${cp.center.y}]` : '';
    return [
      `# Character ${index + 1}${coords}:`,
      normalizeLineEndings(cp.prompt),
    ];
  });
}

/**
 * Build settings line from metadata and optional extras
 *
 * Structured fields are output in A1111-standard order. Extras can override
 * structured fields (taking their position) or append as new entries at the end.
 */
function buildSettingsLine(
  metadata: TextMetadata,
  extras?: Record<string, string | number>,
): string {
  const hires: HiresSettings | undefined = metadata.hires ?? metadata.upscale;
  const loras = metadata.loras ?? [];
  const loraHashes = quoteValue(formatLoraHashes(loras));
  const civitaiResources = isCivitai(metadata)
    ? formatCivitaiResources(loras)
    : undefined;

  // The LoRA keys exist only when they have a value, so an extras entry of
  // the same name keeps its own position when no LoRA is written
  const fields: Record<string, string | number | undefined> = {
    Steps: metadata.sampling?.steps,
    Sampler: metadata.sampling?.sampler,
    'Schedule type': metadata.sampling?.scheduler,
    'CFG scale': metadata.sampling?.cfg,
    Seed: metadata.sampling?.seed,
    Size:
      metadata.width > 0 && metadata.height > 0
        ? `${metadata.width}x${metadata.height}`
        : undefined,
    'Model hash': metadata.model?.hash,
    Model: metadata.model?.name,
    'Clip skip': metadata.sampling?.clipSkip,
    // A main-pass strength of 1 (full denoising) is the default and left out
    'Denoising strength':
      hires?.denoise ??
      (metadata.sampling?.denoise !== 1
        ? metadata.sampling?.denoise
        : undefined),
    'Hires upscale': hires?.scale,
    'Hires steps': hires?.steps,
    'Hires upscaler': hires?.upscaler,
    ...(loraHashes === undefined ? {} : { 'Lora hashes': loraHashes }),
    ...(civitaiResources === undefined
      ? {}
      : { 'Civitai resources': civitaiResources }),
  };

  return Object.entries({ ...fields, ...extras })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

/**
 * Return the A1111 text of a parse result as the tool wrote it
 *
 * Applies to software whose metadata parseA1111 reads, when the text
 * (`parameters` chunk, Exif UserComment, or a video's description tag) is
 * not JSON. Only line endings
 * are normalized, so keys the parser does not model (`Version`,
 * `Civitai resources`, Fooocus's `Raw prompt`, …) survive.
 *
 * @returns The text, or undefined when the result must be rebuilt instead
 */
function transcribeA1111(result: {
  metadata: GenerationMetadata;
  raw: RawMetadata | VideoRawMetadata;
}): string | undefined {
  if (!A1111_SOFTWARE.has(result.metadata.software)) return undefined;

  const { raw } = result;
  const entries =
    raw.format === 'png'
      ? pngRawToRecord(raw)
      : 'tags' in raw
        ? videoTagsToRecord(raw.tags)
        : segmentsToRecord(raw.segments);
  const text = entries.parameters ?? entries.UserComment;
  if (text === undefined || text.trimStart().startsWith('{')) return undefined;

  return normalizeLineEndings(text);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build A1111-format text from metadata
 *
 * Output structure:
 * 1. Positive prompt (line-ending normalized), followed by a `<lora:…>` tag
 *    for each LoRA the prompt does not mention yet
 * 2. Character prompts (if present)
 * 3. Negative prompt (if non-empty)
 * 4. Settings line (structured fields, `Lora hashes` when a LoRA has a
 *    hash, extras)
 *
 * Metadata parsed from CivitAI keeps CivitAI's notation instead: no tags,
 * the LoRAs go into a `Civitai resources` list on the settings line.
 *
 * @param metadata - Embed or generation metadata (extras included via `metadata.extras`)
 * @returns A1111-format plain text
 */
export function buildEmbedText(metadata: TextMetadata): string {
  const prompt = isCivitai(metadata)
    ? metadata.prompt
    : injectLoraTags(metadata.prompt, metadata.loras ?? []);

  return [
    normalizeLineEndings(prompt),
    metadata.characterPrompts?.length
      ? buildCharacterPromptsSection(metadata.characterPrompts).join('\n')
      : undefined,
    metadata.negativePrompt
      ? `Negative prompt: ${normalizeLineEndings(metadata.negativePrompt)}`
      : undefined,
    buildSettingsLine(metadata, metadata.extras) || undefined,
  ]
    .filter((s): s is string => s !== undefined)
    .join('\n');
}

/**
 * Format raw metadata as plain text
 *
 * Extracts text content from RawMetadata and returns it as a simple string.
 * Multiple entries are separated by double newlines. Video tags are written
 * as `key: value`, one per entry, since their keys are the only hint of
 * what each value is.
 *
 * @param raw - Raw metadata from ParseResult or VideoParseResult
 * @returns Plain text content from the metadata
 */
export function formatRaw(raw: RawMetadata | VideoRawMetadata): string {
  switch (raw.format) {
    case 'png':
      return raw.chunks.map((chunk) => chunk.text).join('\n\n');

    case 'jpeg':
    case 'webp':
      return raw.segments.map((segment) => segment.data).join('\n\n');

    case 'mp4':
    case 'mov':
    case 'webm':
    case 'mkv':
      return raw.tags.map(({ key, value }) => `${key}: ${value}`).join('\n\n');
  }
}

/**
 * Convert metadata to a human-readable string
 *
 * Accepts multiple input types:
 * - `ParseResult` / `VideoParseResult`: Automatically selects the best
 *   representation based on status. A1111-style text (sd-webui, the Forge
 *   family, SD.Next, and the text schemes of CivitAI and Fooocus) is
 *   returned as the tool wrote it, with line endings normalized; everything
 *   else is rebuilt from the metadata.
 * - `GenerationMetadata`: Formats as A1111 text (parsed metadata from any tool)
 * - `EmbedMetadata`: Formats as A1111 text (user-created custom metadata)
 *
 * When the text is rebuilt, LoRAs become `<lora:name:weight>` tags at the
 * end of the prompt plus a `Lora hashes` entry (see {@link buildEmbedText}).
 *
 * @param input - Parse result (image or video), generation metadata, or
 *   embed metadata
 * @returns Human-readable text representation, or empty string if no data
 *
 * @example
 * ```typescript
 * import { read, stringify } from '@enslo/sd-metadata';
 *
 * // From parse result
 * const result = read(imageData);
 * const text = stringify(result);
 *
 * // From GenerationMetadata (e.g. after parsing)
 * if (result.status === 'success') {
 *   const text3 = stringify(result.metadata);
 * }
 *
 * // From EmbedMetadata (e.g. user-created)
 * const text2 = stringify({
 *   prompt: 'masterpiece, 1girl',
 *   negativePrompt: '',
 *   width: 512,
 *   height: 768,
 *   sampling: { steps: 20, sampler: 'Euler a', cfg: 7, seed: '12345' },
 *   extras: { Version: 'v1.10.0' },
 * });
 * ```
 */
export function stringify(
  input: ParseResult | VideoParseResult | EmbedMetadata | GenerationMetadata,
): string {
  if ('status' in input) {
    switch (input.status) {
      case 'success':
        return transcribeA1111(input) ?? buildEmbedText(input.metadata);
      case 'vendor':
        return originLabel(input.info);
      case 'unrecognized':
        return formatRaw(input.raw);
      case 'empty':
      case 'invalid':
        return '';
    }
  }
  return buildEmbedText(input);
}
