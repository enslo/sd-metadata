/**
 * Embed API for sd-metadata
 *
 * Flexible metadata writing that accepts EmbedMetadata (no software field
 * required) and optional extras for custom settings line entries.
 * Writes metadata in A1111 format to PNG, JPEG, or WebP images.
 */

import { createEncodedChunk } from '../converters/chunk-encoding';
import { buildEmbedText } from '../serializers/embed';
import type { EmbedMetadata } from '../types';
import { Result } from '../types';
import type { ImageFormat } from '../utils/binary';
import { detectFormat, toUint8Array } from '../utils/binary';
import { writeJpegMetadata } from '../writers/jpeg';
import { writePngMetadata } from '../writers/png';
import { writeWebpMetadata } from '../writers/webp';
import type { WriteResult } from './write';

/**
 * Embed metadata into an image
 *
 * Converts the provided EmbedMetadata (and optional extras) to A1111 plain
 * text format and embeds it into the image. Unlike writeAsWebUI, this function
 * does not require a `software` field, making it ideal for user-created metadata.
 *
 * Extras allow adding arbitrary key-value pairs to the settings line.
 * If an extras key matches a structured field (e.g., "Steps"), the extras
 * value overrides the structured value at its original position.
 *
 * The metadata is stored differently based on image format:
 * - PNG: `parameters` tEXt/iTXt chunk (encoding auto-selected based on content)
 * - JPEG/WebP: Exif UserComment field
 *
 * @param input - Target image file data (Uint8Array or ArrayBuffer)
 * @param metadata - Metadata to embed (no software field required)
 * @param extras - Optional key-value pairs for the settings line
 * @returns New image data with embedded metadata, or error
 *
 * @example
 * ```typescript
 * import { embed } from '@enslo/sd-metadata';
 *
 * const metadata = {
 *   prompt: 'masterpiece, 1girl',
 *   negativePrompt: 'lowres, bad quality',
 *   width: 512,
 *   height: 768,
 *   sampling: { steps: 20, sampler: 'Euler a', cfg: 7, seed: 12345 },
 *   model: { name: 'model.safetensors' },
 * };
 *
 * // Embed with custom extras
 * const result = embed(imageData, metadata, {
 *   Version: 'v1.10.0',
 *   'Lora hashes': 'abc123',
 * });
 *
 * if (result.ok) {
 *   writeFileSync('output.png', result.value);
 * }
 * ```
 */
export function embed(
  input: Uint8Array | ArrayBuffer,
  metadata: EmbedMetadata,
  extras?: Record<string, string | number>,
): WriteResult {
  const data = toUint8Array(input);

  // Detect image format
  const format = detectFormat(data);
  if (!format) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Build A1111-format text
  const text = buildEmbedText(metadata, extras);

  // Write format-specific metadata
  const writeResult = writeForFormat(format, data, text);

  if (!writeResult.ok) {
    return Result.error({
      type: 'writeFailed',
      message: writeResult.error.type,
    });
  }

  return Result.ok(writeResult.value);
}

/**
 * Write metadata text to image in format-specific way
 */
function writeForFormat(format: ImageFormat, data: Uint8Array, text: string) {
  switch (format) {
    case 'png':
      return writePngMetadata(
        data,
        createEncodedChunk('parameters', text, 'dynamic'),
      );
    case 'jpeg':
      return writeJpegMetadata(data, [
        { source: { type: 'exifUserComment' as const }, data: text },
      ]);
    case 'webp':
      return writeWebpMetadata(data, [
        { source: { type: 'exifUserComment' as const }, data: text },
      ]);
  }
}
