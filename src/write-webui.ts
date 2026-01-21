/**
 * Write metadata to images in SD WebUI format
 *
 * Converts any GenerationMetadata to SD WebUI (A1111) format and embeds it
 * into PNG, JPEG, or WebP images.
 */

import {
  createEncodedChunk,
  getEncodingStrategy,
} from './converters/chunk-encoding';
import { serializeA1111 } from './serializers/a1111';
import type {
  GenerationMetadata,
  MetadataSegment,
  PngTextChunk,
} from './types';
import { Result } from './types';
import { detectFormat } from './utils/binary';
import { writeJpegMetadata } from './writers/jpeg';
import { writePngMetadata } from './writers/png';
import { writeWebpMetadata } from './writers/webp';

// Import WriteResult from index.ts (defined there)
import type { WriteResult } from './index';

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
 * @param data - Target image file data (PNG, JPEG, or WebP)
 * @param metadata - Generation metadata to embed
 * @returns New image data with embedded metadata, or error
 *
 * @example
 * ```typescript
 * import { writeAsWebUI } from 'sd-metadata';
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
 */
export function writeAsWebUI(
  data: Uint8Array,
  metadata: GenerationMetadata,
): WriteResult {
  // Detect image format
  const format = detectFormat(data);
  if (!format) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Convert metadata to A1111 plain text format
  const text = serializeA1111(metadata);

  // Create format-specific metadata structures
  let writeResult:
    | import('./types').PngWriteResult
    | import('./types').JpegWriteResult
    | import('./types').WebpWriteResult;

  if (format === 'png') {
    // PNG: Create parameters chunk with dynamic encoding
    const chunks = createPngChunks(text);
    writeResult = writePngMetadata(data, chunks);
  } else if (format === 'jpeg') {
    // JPEG: Create Exif UserComment segment
    const segments = createExifSegments(text);
    writeResult = writeJpegMetadata(data, segments);
  } else if (format === 'webp') {
    // WebP: Create Exif UserComment segment
    const segments = createExifSegments(text);
    writeResult = writeWebpMetadata(data, segments);
  } else {
    // Shouldn't reach here due to detectFormat check above
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Handle write errors
  if (!writeResult.ok) {
    return Result.error({
      type: 'writeFailed',
      message: writeResult.error.type,
    });
  }

  return Result.ok(writeResult.value);
}

/**
 * Create PNG text chunks for SD WebUI format
 *
 * Uses dynamic encoding strategy (tEXt for ASCII, iTXt for non-ASCII).
 *
 * @param text - A1111-format plain text
 * @returns PNG text chunks
 */
function createPngChunks(text: string): PngTextChunk[] {
  const strategy = getEncodingStrategy('a1111');
  return createEncodedChunk('parameters', text, strategy);
}

/**
 * Create Exif UserComment segment for JPEG/WebP
 *
 * @param text - A1111-format plain text
 * @returns Metadata segment array
 */
function createExifSegments(text: string): MetadataSegment[] {
  return [
    {
      source: { type: 'exifUserComment' },
      data: text,
    },
  ];
}
