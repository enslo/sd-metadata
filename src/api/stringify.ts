/**
 * Unified metadata stringification
 *
 * Builds A1111-format plain text from metadata and provides the stringify()
 * public API for converting any metadata type to a human-readable string.
 */

import type {
  BaseMetadata,
  CharacterPrompt,
  EmbedMetadata,
  GenerationMetadata,
  HiresSettings,
  ParseResult,
  RawMetadata,
} from '../types';

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
 * Build settings line from BaseMetadata and optional extras
 *
 * Structured fields are output in A1111-standard order. Extras can override
 * structured fields (taking their position) or append as new entries at the end.
 */
function buildSettingsLine(
  metadata: BaseMetadata,
  extras?: Record<string, string | number>,
): string {
  const hires: HiresSettings | undefined = metadata.hires ?? metadata.upscale;

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
    'Denoising strength': hires?.denoise,
    'Hires upscale': hires?.scale,
    'Hires steps': hires?.steps,
    'Hires upscaler': hires?.upscaler,
  };

  return Object.entries({ ...fields, ...extras })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build A1111-format text from EmbedMetadata
 *
 * Output structure:
 * 1. Positive prompt (line-ending normalized)
 * 2. Character prompts (if present)
 * 3. Negative prompt (if non-empty)
 * 4. Settings line (structured fields + extras)
 *
 * @param metadata - Embed metadata (extras included via `metadata.extras`)
 * @returns A1111-format plain text
 */
export function buildEmbedText(metadata: EmbedMetadata): string {
  return [
    normalizeLineEndings(metadata.prompt),
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
 * Multiple entries are separated by double newlines.
 *
 * @param raw - Raw metadata from ParseResult
 * @returns Plain text content from the metadata
 */
export function formatRaw(raw: RawMetadata): string {
  switch (raw.format) {
    case 'png':
      return raw.chunks.map((chunk) => chunk.text).join('\n\n');

    case 'jpeg':
    case 'webp':
      return raw.segments.map((segment) => segment.data).join('\n\n');
  }
}

/**
 * Convert metadata to a human-readable string
 *
 * Accepts multiple input types:
 * - `ParseResult`: Automatically selects the best representation based on status
 * - `GenerationMetadata`: Formats as A1111 text (parsed metadata from any tool)
 * - `EmbedMetadata`: Formats as A1111 text (user-created custom metadata)
 *
 * @param input - Parse result, generation metadata, or embed metadata
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
 *   sampling: { steps: 20, sampler: 'Euler a', cfg: 7, seed: 12345 },
 *   extras: { Version: 'v1.10.0' },
 * });
 * ```
 */
export function stringify(
  input: ParseResult | EmbedMetadata | GenerationMetadata,
): string {
  if ('status' in input) {
    switch (input.status) {
      case 'success':
        return buildEmbedText(input.metadata);
      case 'unrecognized':
        return formatRaw(input.raw);
      case 'empty':
      case 'invalid':
        return '';
    }
  }
  return buildEmbedText(input);
}
