import type { MetadataSegment } from '../types';
import { Result } from '../types';
import {
  isWebp,
  readChunkType,
  readUint32LE,
  writeUint32LE,
} from '../utils/binary';
import { buildExifTiffData } from './exif';

// Internal types (co-located with writer)
type WebpWriteError =
  | { type: 'invalidSignature' }
  | { type: 'invalidRiffStructure'; message: string };

type WebpWriteResult = Result<Uint8Array, WebpWriteError>;

/** WebP file signature: "RIFF" */
const RIFF_SIGNATURE = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

/** WebP format marker: "WEBP" */
const WEBP_MARKER = new Uint8Array([0x57, 0x45, 0x42, 0x50]);

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

  // Separate segments by destination
  const xmpSegments = segments.filter((s) => s.source.type === 'xmpPacket');
  const exifSegments = segments.filter((s) => s.source.type !== 'xmpPacket');

  // Collect all chunks except EXIF and XMP
  const collectResult = collectNonMetadataChunks(data);
  if (!collectResult.ok) {
    return collectResult;
  }

  const { chunks } = collectResult.value;

  // Build new EXIF chunk from segments
  const exifChunk = buildExifChunk(exifSegments);

  // Build new XMP chunk (only first XMP packet)
  const firstXmp = xmpSegments[0];
  const xmpChunk = firstXmp ? buildXmpChunk(firstXmp.data) : null;

  // Collect metadata chunks to write after image chunk
  const metadataChunks: Uint8Array[] = [];
  if (exifChunk) metadataChunks.push(exifChunk);
  if (xmpChunk) metadataChunks.push(xmpChunk);

  // Calculate new file size (excluding RIFF header)
  let newFileSize = 4; // "WEBP"
  for (const chunk of chunks) {
    newFileSize += chunk.length;
  }
  for (const meta of metadataChunks) {
    newFileSize += meta.length;
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

  // Write metadata chunks after first image-related chunk (VP8/VP8L/VP8X)
  let metadataWritten = false;

  for (const chunk of chunks) {
    // Write chunks in original order
    output.set(chunk, offset);
    offset += chunk.length;

    // Write metadata after first image-related chunk for best compatibility
    if (!metadataWritten && metadataChunks.length > 0 && isImageChunk(chunk)) {
      for (const meta of metadataChunks) {
        output.set(meta, offset);
        offset += meta.length;
      }
      metadataWritten = true;
    }
  }

  // If metadata wasn't written yet (no VP8* chunk found), append it
  if (!metadataWritten) {
    for (const meta of metadataChunks) {
      output.set(meta, offset);
      offset += meta.length;
    }
  }

  return Result.ok(output);
}

/**
 * Check if chunk is an image-related chunk (VP8, VP8L, VP8X)
 */
function isImageChunk(chunk: Uint8Array): boolean {
  if (chunk.length < 4) return false;
  const type = readChunkType(chunk, 0);
  return type === 'VP8 ' || type === 'VP8L' || type === 'VP8X';
}

/**
 * Collect all chunks except EXIF and XMP
 */
function collectNonMetadataChunks(
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
    // Read chunk type and size
    const typeStr = readChunkType(data, offset);
    const chunkSize = readUint32LE(data, offset + 4);

    if (!firstChunkType) {
      firstChunkType = typeStr;
    }

    // Validate chunk
    if (offset + 8 + chunkSize > data.length) {
      return Result.error({
        type: 'invalidRiffStructure',
        message: `Chunk extends beyond file at offset ${offset}`,
      });
    }

    // Keep all chunks except EXIF and XMP
    if (typeStr !== 'EXIF' && typeStr !== 'XMP ') {
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
  if (segments.length === 0) {
    return null;
  }

  const tiffData = buildExifTiffData(segments);

  if (tiffData.length === 0) {
    return null;
  }

  // Build EXIF chunk: type (4) + size (4) + TIFF data
  const chunkSize = tiffData.length;
  const paddedSize = chunkSize + (chunkSize % 2);
  const chunk = new Uint8Array(8 + paddedSize);

  // Write "EXIF" chunk type
  chunk.set(new TextEncoder().encode('EXIF'));
  writeUint32LE(chunk, 4, chunkSize);
  chunk.set(tiffData, 8);

  return chunk;
}

/**
 * Build XMP chunk from XMP text
 */
function buildXmpChunk(xmpText: string): Uint8Array {
  const textBytes = new TextEncoder().encode(xmpText);

  // Build XMP chunk: type (4) + size (4) + XMP data (+ padding if odd)
  const chunkSize = textBytes.length;
  const paddedSize = chunkSize + (chunkSize % 2);
  const chunk = new Uint8Array(8 + paddedSize);

  // Write "XMP " chunk type (trailing space)
  chunk.set(new TextEncoder().encode('XMP '));
  writeUint32LE(chunk, 4, chunkSize);
  chunk.set(textBytes, 8);

  return chunk;
}
