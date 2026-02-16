/**
 * Embed metadata text builder
 *
 * Builds A1111-format plain text from EmbedMetadata and optional extras.
 * Used by the embed() API to generate text for embedding into images.
 */

import type {
  BaseMetadata,
  CharacterPrompt,
  EmbedMetadata,
  HiresSettings,
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
