/**
 * Deprecated A1111-format serializer
 *
 * @deprecated Use {@link stringify} from `@enslo/sd-metadata` instead.
 * This module is retained for backward compatibility only.
 */

import type { GenerationMetadata } from '../types';
import { buildEmbedText } from './embed';

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
  return buildEmbedText(metadata);
}
