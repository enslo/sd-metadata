import type { MetadataSegment } from '../types';
import { Result } from '../types';
import { arraysEqual } from '../utils/binary';
import { parseExifMetadataSegments } from './exif';

import { isJpeg } from '../utils/binary';

// Internal types (co-located with reader)
type JpegReadError = { type: 'invalidSignature' };

type JpegMetadataResult = Result<MetadataSegment[], JpegReadError>;

/** APP1 marker */
const APP1_MARKER = 0xe1;

/** COM (Comment) marker */
const COM_MARKER = 0xfe;

/** Exif header: "Exif\0\0" */
const EXIF_HEADER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);

/**
 * Read JPEG metadata from binary data
 *
 * Collects metadata from multiple sources:
 * - Exif tags (APP1 segment): UserComment, ImageDescription, Make
 * - COM segment - Used by NovelAI
 *
 * @param data - JPEG file data as Uint8Array
 * @returns Result containing all metadata segments or error
 */
export function readJpegMetadata(data: Uint8Array): JpegMetadataResult {
  if (!isJpeg(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  const segments: MetadataSegment[] = [];

  // Extract all Exif metadata (UserComment, ImageDescription, Make)
  const app1 = findApp1Segment(data);
  if (app1) {
    const exifData = data.slice(app1.offset, app1.offset + app1.length);
    const exifSegments = parseExifMetadataSegments(exifData);
    segments.push(...exifSegments);
  }

  // Try COM segment (NovelAI uses this)
  const comSegment = findComSegment(data);
  if (comSegment) {
    const comData = data.slice(
      comSegment.offset,
      comSegment.offset + comSegment.length,
    );
    const comText = decodeComSegment(comData);

    if (comText !== null) {
      segments.push({
        source: { type: 'jpegCom' },
        data: comText,
      });
    }
  }

  return Result.ok(segments);
}

/**
 * Find APP1 segment containing Exif data
 *
 * @param data - JPEG file data
 * @returns Offset and length of APP1 segment data, or null if not found
 */
function findApp1Segment(
  data: Uint8Array,
): { offset: number; length: number } | null {
  let offset = 2; // Skip SOI marker

  while (offset < data.length - 4) {
    // Check for marker
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1];

    // Skip padding bytes
    if (marker === 0xff) {
      offset++;
      continue;
    }

    // Get segment length (big-endian, includes length bytes)
    const length = ((data[offset + 2] ?? 0) << 8) | (data[offset + 3] ?? 0);

    // Check for APP1 marker
    if (marker === APP1_MARKER) {
      // Verify Exif header
      const headerStart = offset + 4;
      if (headerStart + 6 <= data.length) {
        const header = data.slice(headerStart, headerStart + 6);
        if (arraysEqual(header, EXIF_HEADER)) {
          // Return offset to TIFF data (after Exif header)
          return {
            offset: headerStart + 6,
            length: length - 8, // Subtract length bytes and Exif header
          };
        }
      }
    }

    // Move to next segment
    offset += 2 + length;

    // Stop at SOS (Start of Scan) or EOI
    if (marker === 0xda || marker === 0xd9) {
      break;
    }
  }

  return null;
}

/**
 * Find COM (Comment) segment
 *
 * COM segments are used by NovelAI to store metadata as UTF-8 JSON.
 *
 * @param data - JPEG file data
 * @returns Offset and length of COM segment data, or null if not found
 */
function findComSegment(
  data: Uint8Array,
): { offset: number; length: number } | null {
  let offset = 2; // Skip SOI marker

  while (offset < data.length - 4) {
    // Check for marker
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1];

    // Skip padding bytes
    if (marker === 0xff) {
      offset++;
      continue;
    }

    // Get segment length (big-endian, includes length bytes)
    const length = ((data[offset + 2] ?? 0) << 8) | (data[offset + 3] ?? 0);

    // Check for COM marker
    if (marker === COM_MARKER) {
      // Return offset to comment data (after marker and length)
      return {
        offset: offset + 4,
        length: length - 2, // Subtract length bytes only
      };
    }

    // Move to next segment
    offset += 2 + length;

    // Stop at SOS (Start of Scan) or EOI
    if (marker === 0xda || marker === 0xd9) {
      break;
    }
  }

  return null;
}

/**
 * Decode COM segment data as UTF-8 string
 *
 * @param data - COM segment data
 * @returns Decoded string or null if invalid
 */
function decodeComSegment(data: Uint8Array): string | null {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(data);
  } catch {
    return null;
  }
}
