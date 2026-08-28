/**
 * Parse API for sd-metadata
 *
 * The primary entry point for reading metadata. Extends read() with an
 * asynchronous fallback that recovers Stealth PNGInfo — generation
 * metadata hidden in pixel least-significant bits by NovelAI and the
 * stealth-pnginfo family of extensions — when a PNG carries no readable
 * metadata chunks.
 */

import { parseMetadata } from '../parsers';
import { readStealthChunks } from '../readers/stealth';
import type { ParseResult, PngTextChunk, ReadOptions } from '../types';
import { detectFormat, toUint8Array } from '../utils/binary';
import { pngChunksToRecord } from '../utils/convert';
import { applyDimensionFallback, read } from './read';

/**
 * Read and parse metadata from an image
 *
 * Automatically detects the image format (PNG, JPEG, WebP) and parses
 * any embedded generation metadata. For PNGs without readable metadata
 * chunks, additionally scans pixel data for Stealth PNGInfo, so
 * metadata survives even when text chunks were stripped (e.g. by image
 * hosting services).
 *
 * The stealth scan decodes the full pixel data, so it only runs when
 * chunk-based metadata is absent.
 *
 * @example
 * ```typescript
 * import { parse } from '@enslo/sd-metadata';
 *
 * const result = await parse(imageData);
 * if (result.status === 'success') {
 *   console.log(result.metadata.prompt);
 * }
 * ```
 *
 * @param input - Image file data (Uint8Array or ArrayBuffer)
 * @param options - Read options
 * @returns Parse result containing metadata and raw data
 */
export async function parse(
  input: Uint8Array | ArrayBuffer,
  options?: ReadOptions,
): Promise<ParseResult> {
  const data = toUint8Array(input);
  const chunkResult = read(data, options);

  // Only PNGs without parsed generation metadata warrant a stealth scan.
  if (chunkResult.status === 'success' || chunkResult.status === 'invalid') {
    return chunkResult;
  }
  if (detectFormat(data) !== 'png') {
    return chunkResult;
  }

  let chunks: PngTextChunk[] | null;
  try {
    chunks = await readStealthChunks(data);
  } catch {
    chunks = null;
  }
  if (!chunks || chunks.length === 0) {
    return chunkResult;
  }

  const parseResult = parseMetadata(pngChunksToRecord(chunks));
  if (parseResult.ok) {
    const metadata = parseResult.value;
    applyDimensionFallback(metadata, data, 'png', options);
    return { status: 'success', metadata, raw: { format: 'png', chunks } };
  }

  // Stealth data exists but is in an unknown format: surface it rather
  // than reporting an empty file. Chunk-based results (unrecognized,
  // c2pa) stay as they are.
  if (chunkResult.status === 'empty') {
    return { status: 'unrecognized', raw: { format: 'png', chunks } };
  }
  return chunkResult;
}
