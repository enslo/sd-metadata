/**
 * Parse API for sd-metadata
 *
 * The primary entry point for reading metadata. Extends read() with an
 * asynchronous fallback that recovers Stealth PNGInfo — generation
 * metadata hidden in pixel least-significant bits by NovelAI and the
 * stealth-pnginfo family of extensions — when an image carries no
 * readable metadata.
 */

import { parseMetadata } from '../parsers';
import { decodePixelsWithPlatform } from '../readers/pixel-decode';
import { readStealthChunks, scanStealthPixels } from '../readers/stealth';
import type { ParseResult, PngTextChunk, ReadOptions } from '../types';
import { detectFormat, toUint8Array } from '../utils/binary';
import { pngChunksToRecord } from '../utils/convert';
import { applyDimensionFallback, read } from './read';

/**
 * Read and parse metadata from an image
 *
 * Automatically detects the image format (PNG, JPEG, WebP) and parses
 * any embedded generation metadata. For images without readable
 * metadata, additionally scans pixel data for Stealth PNGInfo, so
 * metadata survives even when metadata chunks were stripped (e.g. by
 * image hosting services).
 *
 * The stealth scan decodes the full pixel data, so it only runs when
 * regular metadata is absent. PNG pixels are decoded by the library
 * itself. WebP pixels are decoded by the platform where possible
 * (browsers, via WebCodecs or canvas); in other runtimes supply
 * {@link ReadOptions.decodePixels} (e.g. backed by sharp in Node.js)
 * or the WebP stealth scan is skipped.
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

  // Only images without parsed generation metadata warrant a stealth
  // scan, and only PNG and WebP carry stealth data.
  if (chunkResult.status === 'success' || chunkResult.status === 'invalid') {
    return chunkResult;
  }
  const format = detectFormat(data);
  if (format !== 'png' && format !== 'webp') {
    return chunkResult;
  }

  let chunks: PngTextChunk[] | null;
  try {
    chunks =
      format === 'png'
        ? await readStealthChunks(data)
        : await readWebpStealthChunks(data, options);
  } catch {
    chunks = null;
  }
  if (!chunks || chunks.length === 0) {
    return chunkResult;
  }

  const parseResult = parseMetadata(pngChunksToRecord(chunks));
  if (parseResult.ok) {
    const metadata = parseResult.value;
    applyDimensionFallback(metadata, data, format, options);
    // Stealth payloads are keyword/text pairs regardless of container,
    // so the recovered raw metadata is always chunk-shaped ('png').
    // write() converts it to the target container's native layout.
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

/**
 * Decode WebP pixels and scan them for stealth data
 *
 * An injected decoder takes precedence; the platform decoder fills in
 * when none is supplied or it returns null. Without either, WebP
 * stealth data is not recoverable and null is returned.
 */
async function readWebpStealthChunks(
  data: Uint8Array,
  options?: ReadOptions,
): Promise<PngTextChunk[] | null> {
  const pixels =
    (await options?.decodePixels?.(data, 'webp')) ??
    (await decodePixelsWithPlatform(data, 'image/webp'));
  return pixels ? scanStealthPixels(pixels) : null;
}
