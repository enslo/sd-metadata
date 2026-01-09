import type { MetadataSegment, WebpMetadataResult } from '../types';
import { Result } from '../types';
import { readUint32LE } from '../utils/binary';
import { detectSoftware, parseExifUserComment } from '../utils/exif';

/** WebP file signature: "RIFF" */
const RIFF_SIGNATURE = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

/** WebP format marker: "WEBP" */
const WEBP_MARKER = new Uint8Array([0x57, 0x45, 0x42, 0x50]);

/** EXIF chunk type */
const EXIF_CHUNK_TYPE = new Uint8Array([0x45, 0x58, 0x49, 0x46]);

/**
 * Read WebP metadata from binary data
 *
 * Extracts metadata from EXIF chunk in WebP files.
 * The EXIF chunk contains TIFF-formatted data identical to JPEG Exif.
 *
 * @param data - WebP file data as Uint8Array
 * @returns Result containing all metadata segments or error
 */
export function readWebpMetadata(data: Uint8Array): WebpMetadataResult {
  if (!isValidWebpSignature(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  const exifChunk = findExifChunk(data);
  if (!exifChunk) {
    return Result.error({ type: 'noExifChunk' });
  }

  const segments: MetadataSegment[] = [];

  const exifData = data.slice(
    exifChunk.offset,
    exifChunk.offset + exifChunk.length,
  );
  const userComment = parseExifUserComment(exifData);

  if (userComment !== null) {
    segments.push({
      source: { type: 'exifUserComment' },
      data: userComment,
    });
  }

  // No metadata found
  if (segments.length === 0) {
    return Result.error({ type: 'noMetadata' });
  }

  // Detect software from all segments
  const software = detectSoftwareFromSegments(segments);

  return Result.ok({
    segments,
    software,
  });
}

/**
 * Detect software from multiple segments
 */
function detectSoftwareFromSegments(segments: MetadataSegment[]) {
  for (const segment of segments) {
    const software = detectSoftware(segment.data);
    if (software !== null) {
      return software;
    }
  }
  return null;
}

/**
 * Validate WebP signature
 *
 * WebP files start with "RIFF" followed by file size (4 bytes) and "WEBP"
 *
 * @param data - WebP file data
 * @returns true if valid WebP signature
 */
export function isValidWebpSignature(data: Uint8Array): boolean {
  if (data.length < 12) return false;

  // Check "RIFF" signature
  for (let i = 0; i < 4; i++) {
    if (data[i] !== RIFF_SIGNATURE[i]) return false;
  }

  // Check "WEBP" marker at offset 8
  for (let i = 0; i < 4; i++) {
    if (data[i + 8] !== WEBP_MARKER[i]) return false;
  }

  return true;
}

/**
 * Find EXIF chunk in WebP file
 *
 * WebP uses RIFF container format with named chunks.
 * EXIF chunk contains TIFF data starting with "II" or "MM" byte order marker.
 *
 * @param data - WebP file data
 * @returns Offset and length of EXIF chunk data, or null if not found
 */
export function findExifChunk(
  data: Uint8Array,
): { offset: number; length: number } | null {
  // Start after RIFF header (12 bytes: "RIFF" + size + "WEBP")
  let offset = 12;

  while (offset < data.length - 8) {
    // Read chunk type (4 bytes)
    const chunkType = data.slice(offset, offset + 4);

    // Read chunk size (4 bytes, little-endian)
    const chunkSize = readUint32LE(data, offset + 4);

    // Check for EXIF chunk
    if (arraysEqual(chunkType, EXIF_CHUNK_TYPE)) {
      // EXIF chunk data starts after type and size
      return {
        offset: offset + 8,
        length: chunkSize,
      };
    }

    // Move to next chunk (chunk size + type + size fields)
    // RIFF chunks are padded to even byte boundaries
    const paddedSize = chunkSize + (chunkSize % 2);
    offset += 8 + paddedSize;
  }

  return null;
}

/**
 * Compare two Uint8Arrays for equality
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Re-export detectSoftware for convenience
export { detectSoftware };
