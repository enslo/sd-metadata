/**
 * JPEG Metadata Writer
 *
 * Writes metadata segments to JPEG files.
 */

import type { JpegWriteResult, MetadataSegment } from '../types';
import { Result } from '../types';

/** JPEG file signature (magic bytes): FFD8 */
const JPEG_SIGNATURE = new Uint8Array([0xff, 0xd8]);

/** APP1 marker */
const APP1_MARKER = 0xe1;

/** COM (Comment) marker */
const COM_MARKER = 0xfe;

/** Exif header: "Exif\0\0" */
const EXIF_HEADER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);

/**
 * Write JPEG metadata to binary data
 *
 * Replaces existing APP1 (Exif) and COM segments with the provided segments.
 * Segments are inserted immediately after the SOI marker.
 *
 * @param data - Original JPEG file data as Uint8Array
 * @param segments - Metadata segments to embed
 * @returns Result containing new JPEG data with embedded metadata
 */
export function writeJpegMetadata(
  data: Uint8Array,
  segments: MetadataSegment[],
): JpegWriteResult {
  // Validate JPEG signature
  if (!isValidJpegSignature(data)) {
    return Result.error({ type: 'invalidSignature' });
  }

  // Find positions of existing APP1 and COM segments to remove
  const segmentsToRemove = findSegmentsToRemove(data);

  // Build new segments
  const newSegmentData: Uint8Array[] = [];

  for (const segment of segments) {
    switch (segment.source.type) {
      case 'exifUserComment':
        newSegmentData.push(buildExifUserCommentSegment(segment.data));
        break;
      case 'jpegCom':
        newSegmentData.push(buildComSegment(segment.data));
        break;
      case 'exifImageDescription':
      case 'exifMake':
        // TODO: Support these Exif tags in a combined APP1 segment
        // For now, fall back to UserComment
        newSegmentData.push(buildExifUserCommentSegment(segment.data));
        break;
    }
  }

  // Calculate new file size
  let removedSize = 0;
  for (const seg of segmentsToRemove) {
    removedSize += seg.length + 4; // +4 for marker and length bytes
  }

  let addedSize = 0;
  for (const seg of newSegmentData) {
    addedSize += seg.length;
  }

  const newSize = data.length - removedSize + addedSize;
  const result = new Uint8Array(newSize);

  // Write SOI marker
  result.set(JPEG_SIGNATURE, 0);
  let writeOffset = 2;

  // Write new segments
  for (const seg of newSegmentData) {
    result.set(seg, writeOffset);
    writeOffset += seg.length;
  }

  // Copy remaining data, skipping removed segments
  let readOffset = 2;
  let segmentIndex = 0;

  while (readOffset < data.length) {
    // Check if we're at a segment to remove
    if (
      segmentIndex < segmentsToRemove.length &&
      readOffset === segmentsToRemove[segmentIndex].offset
    ) {
      const seg = segmentsToRemove[segmentIndex];
      readOffset = seg.offset + seg.length + 4;
      segmentIndex++;
      continue;
    }

    // Check for marker
    if (data[readOffset] === 0xff && readOffset + 1 < data.length) {
      const marker = data[readOffset + 1];

      // Skip standalone markers
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        result[writeOffset++] = data[readOffset++];
        result[writeOffset++] = data[readOffset++];
        continue;
      }

      // Check for SOS (Start of Scan) - copy rest of file
      if (marker === 0xda) {
        const remaining = data.length - readOffset;
        result.set(data.subarray(readOffset), writeOffset);
        writeOffset += remaining;
        break;
      }

      // Regular segment with length
      if (readOffset + 4 <= data.length) {
        const length = (data[readOffset + 2] << 8) | data[readOffset + 3];
        const segmentSize = 2 + length; // marker + length + data

        // Copy segment
        result.set(
          data.subarray(readOffset, readOffset + segmentSize),
          writeOffset,
        );
        writeOffset += segmentSize;
        readOffset += segmentSize;
        continue;
      }
    }

    // Copy byte
    result[writeOffset++] = data[readOffset++];
  }

  return Result.ok(result.subarray(0, writeOffset));
}

/**
 * Validate JPEG signature
 */
function isValidJpegSignature(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  return data[0] === JPEG_SIGNATURE[0] && data[1] === JPEG_SIGNATURE[1];
}

/**
 * Find APP1 and COM segments to remove
 */
function findSegmentsToRemove(
  data: Uint8Array,
): Array<{ offset: number; length: number }> {
  const segments: Array<{ offset: number; length: number }> = [];
  let offset = 2; // Skip SOI

  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1];

    // Check for SOS - stop scanning
    if (marker === 0xda) break;

    // Skip standalone markers
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // Get segment length
    if (offset + 4 > data.length) break;
    const length = (data[offset + 2] << 8) | data[offset + 3];

    // Check for APP1 (Exif) or COM
    if (marker === APP1_MARKER || marker === COM_MARKER) {
      segments.push({ offset: offset, length: length });
    }

    offset += 2 + length;
  }

  return segments;
}

/**
 * Build APP1 Exif segment with UserComment
 */
function buildExifUserCommentSegment(text: string): Uint8Array {
  // Encode text as UTF-16LE (what most tools expect after UNICODE prefix)
  const textBytes = encodeUtf16LE(text);

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

  // Build TIFF structure
  const tiffData = buildTiffWithUserComment(userCommentData);

  // Build APP1 segment
  const segmentLength = 2 + EXIF_HEADER.length + tiffData.length;
  const segment = new Uint8Array(2 + segmentLength);

  let offset = 0;
  segment[offset++] = 0xff;
  segment[offset++] = APP1_MARKER;
  segment[offset++] = (segmentLength >> 8) & 0xff;
  segment[offset++] = segmentLength & 0xff;
  segment.set(EXIF_HEADER, offset);
  offset += EXIF_HEADER.length;
  segment.set(tiffData, offset);

  return segment;
}

/**
 * Build TIFF structure with UserComment tag
 */
function buildTiffWithUserComment(userCommentData: Uint8Array): Uint8Array {
  // Use big-endian (MM) for simplicity
  const ifdEntryCount = 1;
  const ifd0Size = 2 + ifdEntryCount * 12 + 4; // count + entries + next IFD pointer

  // Exif IFD with UserComment
  const exifIfdEntryCount = 1;
  const exifIfdSize = 2 + exifIfdEntryCount * 12 + 4;

  // Calculate offsets
  const headerSize = 8; // II/MM + magic + IFD0 offset
  const ifd0Offset = headerSize;
  const exifIfdOffset = ifd0Offset + ifd0Size;
  const userCommentOffset = exifIfdOffset + exifIfdSize;

  const totalSize = userCommentOffset + userCommentData.length;
  const tiff = new Uint8Array(totalSize);

  let offset = 0;

  // TIFF header (big-endian)
  tiff[offset++] = 0x4d; // 'M'
  tiff[offset++] = 0x4d; // 'M'
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x2a; // Magic 42
  // IFD0 offset
  tiff[offset++] = (ifd0Offset >> 24) & 0xff;
  tiff[offset++] = (ifd0Offset >> 16) & 0xff;
  tiff[offset++] = (ifd0Offset >> 8) & 0xff;
  tiff[offset++] = ifd0Offset & 0xff;

  // IFD0
  tiff[offset++] = 0x00;
  tiff[offset++] = ifdEntryCount;

  // Exif IFD pointer tag (0x8769)
  tiff[offset++] = 0x87;
  tiff[offset++] = 0x69;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x04; // LONG
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x01; // Count = 1
  // Value: Exif IFD offset
  tiff[offset++] = (exifIfdOffset >> 24) & 0xff;
  tiff[offset++] = (exifIfdOffset >> 16) & 0xff;
  tiff[offset++] = (exifIfdOffset >> 8) & 0xff;
  tiff[offset++] = exifIfdOffset & 0xff;

  // Next IFD pointer (0)
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;

  // Exif IFD
  tiff[offset++] = 0x00;
  tiff[offset++] = exifIfdEntryCount;

  // UserComment tag (0x9286)
  tiff[offset++] = 0x92;
  tiff[offset++] = 0x86;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x07; // UNDEFINED
  // Count
  const count = userCommentData.length;
  tiff[offset++] = (count >> 24) & 0xff;
  tiff[offset++] = (count >> 16) & 0xff;
  tiff[offset++] = (count >> 8) & 0xff;
  tiff[offset++] = count & 0xff;
  // Value offset
  tiff[offset++] = (userCommentOffset >> 24) & 0xff;
  tiff[offset++] = (userCommentOffset >> 16) & 0xff;
  tiff[offset++] = (userCommentOffset >> 8) & 0xff;
  tiff[offset++] = userCommentOffset & 0xff;

  // Next IFD pointer (0)
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;
  tiff[offset++] = 0x00;

  // UserComment data
  tiff.set(userCommentData, offset);

  return tiff;
}

/**
 * Build COM segment
 */
function buildComSegment(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);

  const segmentLength = 2 + textBytes.length;
  const segment = new Uint8Array(2 + segmentLength);

  segment[0] = 0xff;
  segment[1] = COM_MARKER;
  segment[2] = (segmentLength >> 8) & 0xff;
  segment[3] = segmentLength & 0xff;
  segment.set(textBytes, 4);

  return segment;
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
