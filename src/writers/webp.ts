/**
 * WebP Metadata Writer
 *
 * Writes metadata segments to WebP files.
 */

import type { MetadataSegment, WebpWriteResult } from '../types';
import { Result } from '../types';

/** RIFF header */
const RIFF_HEADER = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // "RIFF"

/** WEBP signature */
const WEBP_SIGNATURE = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // "WEBP"

/** EXIF chunk type */
const EXIF_CHUNK_TYPE = new Uint8Array([0x45, 0x58, 0x49, 0x46]); // "EXIF"

/**
 * Write WebP metadata to binary data
 *
 * Replaces existing EXIF chunk with the provided segments.
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
  if (!isValidWebpSignature(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Find existing EXIF chunk
  const existingExif = findExifChunk(data);

  // Build new EXIF chunk from segments
  const newExifData = buildExifData(segments);
  const newExifChunk = buildExifChunk(newExifData);

  // Calculate new file size
  const existingExifSize = existingExif ? existingExif.totalSize : 0;
  const newSize = data.length - existingExifSize + newExifChunk.length;

  const result = new Uint8Array(newSize);

  // Copy RIFF header
  result.set(data.subarray(0, 12), 0);

  // Insert new EXIF chunk right after RIFF/WEBP header
  let writeOffset = 12;
  result.set(newExifChunk, writeOffset);
  writeOffset += newExifChunk.length;

  // Copy remaining chunks, skipping old EXIF
  let readOffset = 12;

  while (readOffset < data.length - 8) {
    const chunkType = String.fromCharCode(
      ...data.subarray(readOffset, readOffset + 4),
    );
    const chunkSize = readUint32LE(data, readOffset + 4);
    const paddedSize = chunkSize + (chunkSize % 2); // WebP chunks are padded to even length
    const totalChunkSize = 8 + paddedSize;

    // Skip old EXIF chunk
    if (chunkType === 'EXIF') {
      readOffset += totalChunkSize;
      continue;
    }

    // Copy chunk
    result.set(
      data.subarray(readOffset, readOffset + totalChunkSize),
      writeOffset,
    );
    writeOffset += totalChunkSize;
    readOffset += totalChunkSize;
  }

  // Update RIFF size
  const riffSize = writeOffset - 8;
  writeUint32LE(result, 4, riffSize);

  return Result.ok(result.subarray(0, writeOffset));
}

/**
 * Validate WebP signature
 */
function isValidWebpSignature(data: Uint8Array): boolean {
  if (data.length < 12) return false;

  for (let i = 0; i < 4; i++) {
    if (data[i] !== RIFF_HEADER[i]) return false;
    if (data[i + 8] !== WEBP_SIGNATURE[i]) return false;
  }

  return true;
}

/**
 * Find existing EXIF chunk
 */
function findExifChunk(
  data: Uint8Array,
): { offset: number; size: number; totalSize: number } | null {
  let offset = 12;

  while (offset < data.length - 8) {
    const chunkType = String.fromCharCode(...data.subarray(offset, offset + 4));
    const chunkSize = readUint32LE(data, offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);
    const totalSize = 8 + paddedSize;

    if (chunkType === 'EXIF') {
      return { offset, size: chunkSize, totalSize };
    }

    offset += totalSize;
  }

  return null;
}

/**
 * Build Exif data from segments
 */
function buildExifData(segments: MetadataSegment[]): Uint8Array {
  // Combine all segments as UserComment
  const combinedText = segments.map((s) => s.data).join('\n');
  // Encode as UTF-16LE (what most tools expect after UNICODE prefix)
  const textBytes = encodeUtf16LE(combinedText);

  // Build TIFF structure with UserComment
  return buildTiffWithUserComment(textBytes);
}

/**
 * Build EXIF chunk
 */
function buildExifChunk(exifData: Uint8Array): Uint8Array {
  const chunkSize = exifData.length;
  const paddedSize = chunkSize + (chunkSize % 2);
  const chunk = new Uint8Array(8 + paddedSize);

  chunk.set(EXIF_CHUNK_TYPE, 0);
  writeUint32LE(chunk, 4, chunkSize);
  chunk.set(exifData, 8);

  return chunk;
}

/**
 * Build TIFF structure with UserComment
 */
function buildTiffWithUserComment(textBytes: Uint8Array): Uint8Array {
  // UserComment: 8 bytes encoding prefix + text
  const unicodePrefix = new Uint8Array([
    0x55,
    0x4e,
    0x49,
    0x43,
    0x4f,
    0x44,
    0x45,
    0x00, // "UNICODE\0"
  ]);
  const userCommentData = new Uint8Array(
    unicodePrefix.length + textBytes.length,
  );
  userCommentData.set(unicodePrefix, 0);
  userCommentData.set(textBytes, unicodePrefix.length);

  // Use big-endian (MM) for simplicity
  const ifdEntryCount = 1;
  const ifd0Size = 2 + ifdEntryCount * 12 + 4;

  const exifIfdEntryCount = 1;
  const exifIfdSize = 2 + exifIfdEntryCount * 12 + 4;

  const headerSize = 8;
  const ifd0Offset = headerSize;
  const exifIfdOffset = ifd0Offset + ifd0Size;
  const userCommentOffset = exifIfdOffset + exifIfdSize;

  const totalSize = userCommentOffset + userCommentData.length;
  const tiff = new Uint8Array(totalSize);

  let offset = 0;

  // TIFF header
  tiff[offset++] = 0x4d; // 'M'
  tiff[offset++] = 0x4d; // 'M'
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x2a; // Magic
  tiff[offset++] = (ifd0Offset >> 24) & 0xff;
  tiff[offset++] = (ifd0Offset >> 16) & 0xff;
  tiff[offset++] = (ifd0Offset >> 8) & 0xff;
  tiff[offset++] = ifd0Offset & 0xff;

  // IFD0
  tiff[offset++] = 0x00;
  tiff[offset++] = ifdEntryCount;

  // Exif IFD pointer
  tiff[offset++] = 0x87;
  tiff[offset++] = 0x69;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x04;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x01;
  tiff[offset++] = (exifIfdOffset >> 24) & 0xff;
  tiff[offset++] = (exifIfdOffset >> 16) & 0xff;
  tiff[offset++] = (exifIfdOffset >> 8) & 0xff;
  tiff[offset++] = exifIfdOffset & 0xff;

  // Next IFD pointer
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;

  // Exif IFD
  tiff[offset++] = 0x00;
  tiff[offset++] = exifIfdEntryCount;

  // UserComment tag
  tiff[offset++] = 0x92;
  tiff[offset++] = 0x86;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x07;
  const count = userCommentData.length;
  tiff[offset++] = (count >> 24) & 0xff;
  tiff[offset++] = (count >> 16) & 0xff;
  tiff[offset++] = (count >> 8) & 0xff;
  tiff[offset++] = count & 0xff;
  tiff[offset++] = (userCommentOffset >> 24) & 0xff;
  tiff[offset++] = (userCommentOffset >> 16) & 0xff;
  tiff[offset++] = (userCommentOffset >> 8) & 0xff;
  tiff[offset++] = userCommentOffset & 0xff;

  // Next IFD pointer
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;

  // UserComment data
  tiff.set(userCommentData, offset);

  return tiff;
}

/**
 * Read 4-byte little-endian unsigned integer
 */
function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}

/**
 * Write 4-byte little-endian unsigned integer
 */
function writeUint32LE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >> 8) & 0xff;
  data[offset + 2] = (value >> 16) & 0xff;
  data[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Encode string as UTF-16LE bytes
 */
function encodeUtf16LE(text: string): Uint8Array {
  const result = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    result[i * 2] = code & 0xff;
    result[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return result;
}
