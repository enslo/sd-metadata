/**
 * Unified metadata stringification
 *
 * Converts a ParseResult, EmbedMetadata, or GenerationMetadata to a
 * human-readable A1111-format string representation.
 */

import type { EmbedMetadata, GenerationMetadata, ParseResult } from '../types';
import { buildEmbedText } from './embed';
import { formatRaw } from './raw';

/**
 * Convert metadata to a human-readable string
 *
 * Accepts multiple input types:
 * - `ParseResult`: Automatically selects the best representation based on status
 * - `GenerationMetadata`: Formats as A1111 text (parsed metadata from any tool)
 * - `EmbedMetadata`: Formats as A1111 text (supports extras in settings line)
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
