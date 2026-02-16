/**
 * Deprecated WebUI (A1111) format writer for sd-metadata
 *
 * @deprecated Use {@link embed} from `@enslo/sd-metadata` instead.
 * This module is retained for backward compatibility only.
 */

import type { GenerationMetadata } from '../types';
import { embed } from './embed';
import type { WriteResult } from './write';

/**
 * Write metadata to an image in SD WebUI format
 *
 * Converts the provided GenerationMetadata to SD WebUI (A1111) plain text
 * format and embeds it into the image. This allows you to:
 * - Create custom metadata from scratch
 * - Modify existing metadata
 * - Convert metadata from any tool to SD WebUI-compatible format
 *
 * The metadata is stored differently based on image format:
 * - PNG: `parameters` tEXt/iTXt chunk (encoding auto-selected based on content)
 * - JPEG/WebP: Exif UserComment field
 *
 * @param input - Target image file data (Uint8Array or ArrayBuffer)
 * @param metadata - Generation metadata to embed
 * @returns New image data with embedded metadata, or error
 *
 * @example
 * ```typescript
 * import { writeAsWebUI } from '@enslo/sd-metadata';
 *
 * // Create custom metadata
 * const metadata = {
 *   software: 'sd-webui',
 *   prompt: 'masterpiece, 1girl',
 *   negativePrompt: 'lowres, bad quality',
 *   width: 512,
 *   height: 768,
 *   sampling: { steps: 20, sampler: 'Euler a', cfg: 7, seed: 12345 },
 *   model: { name: 'model.safetensors' },
 * };
 *
 * // Embed into image
 * const result = writeAsWebUI(imageData, metadata);
 * if (result.ok) {
 *   writeFileSync('output.png', result.value);
 * }
 * ```
 *
 * @deprecated Use {@link embed} instead. The embed function accepts both
 * user-created {@link EmbedMetadata} and {@link GenerationMetadata}, with support for custom
 * extras in the settings line.
 */
export function writeAsWebUI(
  input: Uint8Array | ArrayBuffer,
  metadata: GenerationMetadata,
): WriteResult {
  return embed(input, metadata);
}
