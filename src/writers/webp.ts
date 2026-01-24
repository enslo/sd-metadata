import type { MetadataSegment, WebpWriteResult } from '../types';
import { Result } from '../types';
import { arraysEqual, writeUint32LE } from '../utils/binary';
import { buildExifTiffData } from './exif';

import { isWebp } from '../utils/binary';

/** WebP file signature: "RIFF" */
const RIFF_SIGNATURE = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

/** WebP format marker: "WEBP" */
const WEBP_MARKER = new Uint8Array([0x57, 0x45, 0x42, 0x50]);

/** EXIF chunk type */
const EXIF_CHUNK_TYPE = new Uint8Array([0x45, 0x58, 0x49, 0x46]);

/**
 * Write WebP metadata to binary data
 *
 * Replaces existing EXIF chunk with new metadata.
 * All segments are written to the EXIF chunk based on their source type.
 *
 * @param data - Original WebP file data as Uint8Array
 * @param segments - Metadata segments to embed
 * @returns Result containing new WebP data with embedded metadata
 */
export function writeWebpMetadata(
  data: Uint8Array,
  segments: MetadataSegment[],
): WebpWriteResult {
  // Validate WebP signature
  if (!isWebp(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Collect all chunks except EXIF
  const collectResult = collectNonExifChunks(data);
  if (!collectResult.ok) {
    return collectResult;
  }

  const { chunks } = collectResult.value;

  // Build new EXIF chunk from segments
  const exifChunk = buildExifChunk(segments);

  // Calculate new file size (excluding RIFF header)
  let newFileSize = 4; // "WEBP"
  for (const chunk of chunks) {
    newFileSize += chunk.length;
  }
  if (exifChunk) {
    newFileSize += exifChunk.length;
  }

  // Build output
  const output = new Uint8Array(8 + newFileSize);
  let offset = 0;

  // Write RIFF header
  output.set(RIFF_SIGNATURE, offset);
  offset += 4;
  writeUint32LE(output, offset, newFileSize);
  offset += 4;

  // Write WEBP marker
  output.set(WEBP_MARKER, offset);
  offset += 4;

  // Write EXIF chunk first if we have one (after VP8/VP8L/VP8X)
  // EXIF should come after the image chunk for best compatibility
  let exifWritten = false;

  for (const chunk of chunks) {
    // Write chunks in original order
    output.set(chunk, offset);
    offset += chunk.length;

    // Write EXIF after first image-related chunk (VP8, VP8L, VP8X)
    if (!exifWritten && exifChunk && isImageChunk(chunk)) {
      output.set(exifChunk, offset);
      offset += exifChunk.length;
      exifWritten = true;
    }
  }

  // If EXIF wasn't written yet (no VP8* chunk found), append it
  if (!exifWritten && exifChunk) {
    output.set(exifChunk, offset);
  }

  return Result.ok(output);
}

/**
 * Check if chunk is an image-related chunk (VP8, VP8L, VP8X)
 */
function isImageChunk(chunk: Uint8Array): boolean {
  if (chunk.length < 4) return false;
  const type = String.fromCharCode(
    chunk[0] ?? 0,
    chunk[1] ?? 0,
    chunk[2] ?? 0,
    chunk[3] ?? 0,
  );
  return type === 'VP8 ' || type === 'VP8L' || type === 'VP8X';
}

/**
 * Collect all chunks except EXIF
 */
function collectNonExifChunks(
  data: Uint8Array,
): Result<
  { chunks: Uint8Array[]; firstChunkType: string },
  { type: 'invalidRiffStructure'; message: string }
> {
  const chunks: Uint8Array[] = [];
  let firstChunkType = '';

  // Start after RIFF header (12 bytes: "RIFF" + size + "WEBP")
  let offset = 12;

  while (offset < data.length - 8) {
    // Read chunk type (4 bytes)
    const chunkType = data.slice(offset, offset + 4);
    const typeStr = String.fromCharCode(
      chunkType[0] ?? 0,
      chunkType[1] ?? 0,
      chunkType[2] ?? 0,
      chunkType[3] ?? 0,
    );

    if (!firstChunkType) {
      firstChunkType = typeStr;
    }

    // Read chunk size (4 bytes, little-endian)
    const chunkSize =
      (data[offset + 4] ?? 0) |
      ((data[offset + 5] ?? 0) << 8) |
      ((data[offset + 6] ?? 0) << 16) |
      ((data[offset + 7] ?? 0) << 24);

    // Validate chunk
    if (offset + 8 + chunkSize > data.length) {
      return Result.error({
        type: 'invalidRiffStructure',
        message: `Chunk extends beyond file at offset ${offset}`,
      });
    }

    // Keep all chunks except EXIF
    if (!arraysEqual(chunkType, EXIF_CHUNK_TYPE)) {
      // Include type + size + data (+ padding if odd)
      const paddedSize = chunkSize + (chunkSize % 2);
      const chunkData = data.slice(offset, offset + 8 + paddedSize);
      chunks.push(chunkData);
    }

    // Move to next chunk (chunk size + type + size fields)
    // RIFF chunks are padded to even byte boundaries
    const paddedSize = chunkSize + (chunkSize % 2);
    offset += 8 + paddedSize;
  }

  return Result.ok({ chunks, firstChunkType });
}

/**
 * Build EXIF chunk from metadata segments
 */
function buildExifChunk(segments: MetadataSegment[]): Uint8Array | null {
  // Filter Exif-compatible segments
  const exifSegments = segments.filter(
    (s) =>
      s.source.type === 'exifUserComment' ||
      s.source.type === 'exifImageDescription' ||
      s.source.type === 'exifMake' ||
      s.source.type === 'exifSoftware' ||
      s.source.type === 'exifDocumentName',
  );

  if (exifSegments.length === 0) {
    return null;
  }

  const tiffData = buildExifTiffData(exifSegments);

  if (tiffData.length === 0) {
    return null;
  }

  // Build EXIF chunk: type (4) + size (4) + TIFF data
  const chunkSize = tiffData.length;
  const paddedSize = chunkSize + (chunkSize % 2);
  const chunk = new Uint8Array(8 + paddedSize);

  chunk.set(EXIF_CHUNK_TYPE, 0);
  writeUint32LE(chunk, 4, chunkSize);
  chunk.set(tiffData, 8);

  return chunk;
}
