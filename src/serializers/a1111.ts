/**
 * A1111-format metadata serialization utilities
 *
 * Converts GenerationMetadata to A1111 (SD WebUI) plain text format.
 */

import type {
  GenerationMetadata,
  HiresSettings,
  NovelAIMetadata,
  UpscaleSettings,
} from '../types';

/**
 * Normalize line endings to LF (\n)
 *
 * Ensures consistent line endings across different platforms.
 * Converts CRLF (\r\n) and CR (\r) to LF (\n).
 *
 * @param text - Text with potentially mixed line endings
 * @returns Text with normalized line endings (LF only)
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Merge upscale and hires settings
 *
 * A1111 format does not have separate upscale settings.
 * If both exist, hires takes priority.
 *
 * @param hires - Hires settings
 * @param upscale - Upscale settings
 * @returns Merged hires settings
 */
function mergeUpscaleHires(
  hires?: HiresSettings,
  upscale?: UpscaleSettings,
): HiresSettings | undefined {
  // If hires exists, use it as-is (priority)
  if (hires) {
    return hires;
  }

  // If only upscale exists, convert to hires format
  if (upscale) {
    return {
      scale: upscale.scale,
      upscaler: upscale.upscaler,
      // steps and denoise are not available from upscale
    };
  }

  return undefined;
}

/**
 * Build settings line from metadata
 *
 * Generates the "Steps: X, Sampler: Y, ..." line.
 *
 * @param metadata - Generation metadata
 * @returns Settings line string
 */
function buildSettingsLine(metadata: GenerationMetadata): string {
  const parts: string[] = [];

  // Core settings
  if (metadata.sampling?.steps !== undefined) {
    parts.push(`Steps: ${metadata.sampling.steps}`);
  }

  if (metadata.sampling?.sampler) {
    parts.push(`Sampler: ${metadata.sampling.sampler}`);
  }

  if (metadata.sampling?.scheduler) {
    parts.push(`Schedule type: ${metadata.sampling.scheduler}`);
  }

  if (metadata.sampling?.cfg !== undefined) {
    parts.push(`CFG scale: ${metadata.sampling.cfg}`);
  }

  if (metadata.sampling?.seed !== undefined) {
    parts.push(`Seed: ${metadata.sampling.seed}`);
  }

  // Size (only if both width and height are positive)
  if (metadata.width > 0 && metadata.height > 0) {
    parts.push(`Size: ${metadata.width}x${metadata.height}`);
  }

  // Model
  if (metadata.model?.hash) {
    parts.push(`Model hash: ${metadata.model.hash}`);
  }

  if (metadata.model?.name) {
    parts.push(`Model: ${metadata.model.name}`);
  }

  // Optional: Clip skip
  if (metadata.sampling?.clipSkip !== undefined) {
    parts.push(`Clip skip: ${metadata.sampling.clipSkip}`);
  }

  // Hires.fix / Upscale (merged)
  const mergedHires = mergeUpscaleHires(metadata.hires, metadata.upscale);

  if (mergedHires) {
    if (mergedHires.denoise !== undefined) {
      parts.push(`Denoising strength: ${mergedHires.denoise}`);
    }

    if (mergedHires.scale !== undefined) {
      parts.push(`Hires upscale: ${mergedHires.scale}`);
    }

    if (mergedHires.steps !== undefined) {
      parts.push(`Hires steps: ${mergedHires.steps}`);
    }

    if (mergedHires.upscaler) {
      parts.push(`Hires upscaler: ${mergedHires.upscaler}`);
    }
  }

  return parts.join(', ');
}

/**
 * Build NovelAI character prompts section
 *
 * Generates character prompts delimited by comment lines.
 * Format: # Character N [x, y]:\n[prompt]
 *
 * @param metadata - NovelAI metadata
 * @returns Array of lines (including both header and prompt lines)
 */
function buildCharacterPromptsSection(metadata: NovelAIMetadata): string[] {
  if (!metadata.characterPrompts || metadata.characterPrompts.length === 0) {
    return [];
  }

  const lines: string[] = [];

  for (const [index, cp] of metadata.characterPrompts.entries()) {
    const characterNum = index + 1;
    const coords = cp.center ? ` [${cp.center.x}, ${cp.center.y}]` : '';

    // Header line: # Character N [x, y]:
    lines.push(`# Character ${characterNum}${coords}:`);

    // Prompt line (normalized)
    lines.push(normalizeLineEndings(cp.prompt));
  }

  return lines;
}

/**
 * Format metadata as SD WebUI (A1111) plain text
 *
 * Converts GenerationMetadata to human-readable text in the SD WebUI format.
 * This provides a standard, tool-agnostic way to display generation metadata
 * without needing to manually read individual properties.
 *
 * The output format follows the A1111/SD WebUI convention:
 * ```
 * positive prompt
 * [character prompts for NovelAI]
 * Negative prompt: negative prompt
 * Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 12345, ...
 * ```
 *
 * @deprecated Use {@link stringify} instead. This function requires callers to
 * check `ParseResult.status` before use. The `stringify` function handles all
 * statuses automatically.
 *
 * @param metadata - Generation metadata from any tool
 * @returns Human-readable text in SD WebUI format
 *
 * @example
 * ```typescript
 * import { read, formatAsWebUI } from '@enslo/sd-metadata';
 *
 * const result = read(imageData);
 * if (result.status === 'success') {
 *   const text = formatAsWebUI(result.metadata);
 *   console.log(text);
 *   // Output:
 *   // masterpiece, 1girl
 *   // Negative prompt: low quality, bad anatomy
 *   // Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 512x768, Model: model.safetensors
 * }
 * ```
 */
export function formatAsWebUI(metadata: GenerationMetadata): string {
  const sections: string[] = [];

  // 1. Positive prompt (always present, normalized)
  sections.push(normalizeLineEndings(metadata.prompt));

  // 2. Character prompts (NovelAI only)
  if (metadata.software === 'novelai') {
    const characterLines = buildCharacterPromptsSection(metadata);
    if (characterLines.length > 0) {
      sections.push(characterLines.join('\n'));
    }
  }

  // 3. Negative prompt (if present, normalized)
  if (metadata.negativePrompt) {
    sections.push(
      `Negative prompt: ${normalizeLineEndings(metadata.negativePrompt)}`,
    );
  }

  // 4. Settings line
  const settingsLine = buildSettingsLine(metadata);
  if (settingsLine) {
    sections.push(settingsLine);
  }

  // Join all sections with newlines
  return sections.join('\n');
}
