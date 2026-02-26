import type { MetadataSegment } from '../types';
import { Result } from '../types';
import { isWebp, readChunkType, readUint32LE } from '../utils/binary';
import { parseExifMetadataSegments } from './exif';

// Internal types (co-located with reader)
type WebpReadError = { type: 'invalidSignature' };

type WebpMetadataResult = Result<MetadataSegment[], WebpReadError>;

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
  if (!isWebp(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  const segments: MetadataSegment[] = [];

  const exifChunk = findExifChunk(data);
  if (exifChunk) {
    const exifData = data.slice(
      exifChunk.offset,
      exifChunk.offset + exifChunk.length,
    );
    segments.push(...parseExifMetadataSegments(exifData));
  }

  // Try XMP chunk (Draw Things uses this)
  const xmpChunk = findXmpChunk(data);
  if (xmpChunk) {
    const xmpData = data.slice(
      xmpChunk.offset,
      xmpChunk.offset + xmpChunk.length,
    );
    const xmpText = new TextDecoder('utf-8').decode(xmpData);
    segments.push({
      source: { type: 'xmpPacket' },
      data: xmpText,
    });
  }

  return Result.ok(segments);
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

  while (offset + 8 <= data.length) {
    // Read chunk size (4 bytes, little-endian)
    const chunkSize = readUint32LE(data, offset + 4);

    // Check for EXIF chunk
    if (readChunkType(data, offset) === 'EXIF') {
      if (offset + 8 + chunkSize > data.length) return null;
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
 * Find XMP chunk in WebP file
 *
 * XMP data is stored in a RIFF chunk with FourCC "XMP " (trailing space).
 *
 * @param data - WebP file data
 * @returns Offset and length of XMP chunk data, or null if not found
 */
function findXmpChunk(
  data: Uint8Array,
): { offset: number; length: number } | null {
  let offset = 12; // After RIFF header

  while (offset + 8 <= data.length) {
    const chunkSize = readUint32LE(data, offset + 4);

    if (readChunkType(data, offset) === 'XMP ') {
      if (offset + 8 + chunkSize > data.length) return null;
      return {
        offset: offset + 8,
        length: chunkSize,
      };
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    offset += 8 + paddedSize;
  }

  return null;
}
