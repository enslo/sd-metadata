/**
 * Unified PNG API
 *
 * Provides a simplified API for reading and parsing PNG metadata in one step.
 */

import { parseMetadata } from '../parsers';
import { readPngMetadata } from '../readers/png';
import type { GenerationMetadata, ParseResult, PngReadError } from '../types';
import { Result } from '../types';
import { readUint32BE } from '../utils/binary';
import { pngChunksToEntries } from '../utils/convert';

/** PNG file signature */
const PNG_SIGNATURE_LENGTH = 8;

/**
 * Read and parse PNG metadata in one step
 *
 * This is a convenience function that combines `readPngMetadata` and `parseMetadata`.
 * If the parsed metadata is missing width/height, it will be extracted from the IHDR chunk.
 *
 * For advanced use cases (e.g., accessing raw chunks for write-back), use the
 * individual functions instead.
 *
 * @param data - PNG file data as Uint8Array
 * @returns Parsed generation metadata or error
 *
 * @example
 * ```typescript
 * const result = parsePng(pngData);
 * if (result.ok) {
 *   console.log(result.value.prompt);
 * }
 * ```
 */
export function parsePng(data: Uint8Array): ParseResult {
  // Read PNG chunks
  const readResult = readPngMetadata(data);
  if (!readResult.ok) {
    return Result.error({
      type: 'parseError',
      message: formatReadError(readResult.error),
    });
  }

  const { chunks, software } = readResult.value;

  // Convert chunks to format-agnostic entries
  const entries = pngChunksToEntries(chunks);

  // Parse metadata
  const parseResult = parseMetadata({ entries, software });
  if (!parseResult.ok) {
    return parseResult;
  }

  // Attach the correct raw data to create GenerationMetadata
  const metadata = {
    ...parseResult.value,
    raw: { format: 'png' as const, chunks },
  };

  // Fallback: extract dimensions from IHDR if missing
  if (metadata.width === 0 || metadata.height === 0) {
    const ihdrDimensions = readIhdrDimensions(data);
    if (ihdrDimensions) {
      metadata.width = metadata.width || ihdrDimensions.width;
      metadata.height = metadata.height || ihdrDimensions.height;
    }
  }

  return Result.ok(metadata as GenerationMetadata);
}

/**
 * Read width and height from IHDR chunk
 *
 * IHDR is always the first chunk after the PNG signature.
 * Structure: length(4) + type(4) + width(4) + height(4) + ...
 */
function readIhdrDimensions(
  data: Uint8Array,
): { width: number; height: number } | null {
  // Minimum size: signature(8) + length(4) + type(4) + width(4) + height(4)
  if (data.length < 24) {
    return null;
  }

  // IHDR data starts at offset 16 (after signature + length + type)
  const width = readUint32BE(data, PNG_SIGNATURE_LENGTH + 8);
  const height = readUint32BE(data, PNG_SIGNATURE_LENGTH + 12);

  return { width, height };
}

/**
 * Format read error as human-readable message
 */
function formatReadError(error: PngReadError): string {
  switch (error.type) {
    case 'invalidSignature':
      return 'Not a valid PNG file';
    case 'corruptedChunk':
      return error.message ?? 'Corrupted PNG chunk';
    default:
      return 'Failed to read PNG file';
  }
}
