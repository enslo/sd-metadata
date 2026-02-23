/**
 * Exif writing utilities
 *
 * Functions for building Exif/TIFF structures from metadata segments.
 */

import type { MetadataSegment } from '../types';
import { writeUint16, writeUint32 } from '../utils/binary';
import {
  EXIF_IFD_POINTER_TAG,
  IMAGE_DESCRIPTION_TAG,
  MAKE_TAG,
  USER_COMMENT_TAG,
} from '../utils/exif-constants';

/**
 * Build Exif TIFF data from MetadataSegments
 *
 * Creates a complete TIFF structure with IFD0, Exif IFD, and all tag data.
 * Uses little-endian (Intel) byte order for maximum compatibility.
 *
 * @param segments - Metadata segments to encode
 * @returns TIFF data (starts with "II" byte order marker)
 */
export function buildExifTiffData(segments: MetadataSegment[]): Uint8Array {
  // Separate segments by destination IFD
  const ifd0Segments = segments.filter(
    (s) =>
      s.source.type === 'exifImageDescription' || s.source.type === 'exifMake',
  );
  const exifIfdSegments = segments.filter(
    (s) => s.source.type === 'exifUserComment',
  );

  // No Exif-type segments
  if (ifd0Segments.length === 0 && exifIfdSegments.length === 0) {
    return new Uint8Array(0);
  }

  const isLittleEndian = true;

  // Build tag data for each segment
  const ifd0Tags: Array<{ tag: number; type: number; data: Uint8Array }> = [];
  const exifTags: Array<{ tag: number; type: number; data: Uint8Array }> = [];

  for (const seg of ifd0Segments) {
    if (seg.source.type === 'exifImageDescription') {
      const data = encodeAsciiTag(seg.data, seg.source.prefix);
      ifd0Tags.push({ tag: IMAGE_DESCRIPTION_TAG, type: 2, data });
    } else if (seg.source.type === 'exifMake') {
      const data = encodeAsciiTag(seg.data, seg.source.prefix);
      ifd0Tags.push({ tag: MAKE_TAG, type: 2, data });
    }
  }

  for (const seg of exifIfdSegments) {
    if (seg.source.type === 'exifUserComment') {
      const data = encodeUserComment(seg.data);
      exifTags.push({ tag: USER_COMMENT_TAG, type: 7, data });
    }
  }

  const hasExifIfd = exifTags.length > 0;
  if (hasExifIfd) {
    ifd0Tags.push({
      tag: EXIF_IFD_POINTER_TAG,
      type: 4,
      data: new Uint8Array(4),
    });
  }

  // Sort tags by tag number (required by TIFF spec)
  ifd0Tags.sort((a, b) => a.tag - b.tag);
  exifTags.sort((a, b) => a.tag - b.tag);

  // Calculate sizes and offsets
  const headerSize = 8;
  const ifd0EntryCount = ifd0Tags.length;
  const ifd0Size = 2 + 12 * ifd0EntryCount + 4;
  const exifEntryCount = exifTags.length;
  const exifIfdSize = hasExifIfd ? 2 + 12 * exifEntryCount + 4 : 0;

  const ifd0Offset = headerSize;
  const exifIfdOffset = ifd0Offset + ifd0Size;
  let dataOffset = exifIfdOffset + exifIfdSize;

  // Update Exif IFD pointer in IFD0
  if (hasExifIfd) {
    const exifPtrTag = ifd0Tags.find((t) => t.tag === EXIF_IFD_POINTER_TAG);
    if (exifPtrTag) {
      writeUint32(exifPtrTag.data, 0, exifIfdOffset, isLittleEndian);
    }
  }

  // Assign data offsets for each tag
  const tagDataOffsets = new Map<
    { tag: number; type: number; data: Uint8Array },
    number
  >();

  for (const tag of [...ifd0Tags, ...exifTags]) {
    if (tag.data.length > 4) {
      tagDataOffsets.set(tag, dataOffset);
      dataOffset += tag.data.length;
      if (tag.data.length % 2 !== 0) {
        dataOffset += 1;
      }
    }
  }

  // Build result
  const totalSize = dataOffset;
  const result = new Uint8Array(totalSize);

  // Write TIFF header
  result[0] = 0x49; // I
  result[1] = 0x49; // I (little-endian)
  writeUint16(result, 2, 42, isLittleEndian);
  writeUint32(result, 4, ifd0Offset, isLittleEndian);

  // Write IFD0
  let offset = ifd0Offset;
  writeUint16(result, offset, ifd0EntryCount, isLittleEndian);
  offset += 2;

  for (const tag of ifd0Tags) {
    writeIfdEntry(result, offset, tag, tagDataOffsets.get(tag), isLittleEndian);
    offset += 12;
  }

  writeUint32(result, offset, 0, isLittleEndian);
  offset += 4;

  // Write Exif IFD
  if (hasExifIfd) {
    writeUint16(result, offset, exifEntryCount, isLittleEndian);
    offset += 2;

    for (const tag of exifTags) {
      writeIfdEntry(
        result,
        offset,
        tag,
        tagDataOffsets.get(tag),
        isLittleEndian,
      );
      offset += 12;
    }

    writeUint32(result, offset, 0, isLittleEndian);
  }

  // Write tag data values
  for (const [tag, dataOff] of tagDataOffsets) {
    result.set(tag.data, dataOff);
  }

  return result;
}

/**
 * Write an IFD entry
 */
function writeIfdEntry(
  data: Uint8Array,
  offset: number,
  tag: { tag: number; type: number; data: Uint8Array },
  dataOffset: number | undefined,
  isLittleEndian: boolean,
): void {
  writeUint16(data, offset, tag.tag, isLittleEndian);
  writeUint16(data, offset + 2, tag.type, isLittleEndian);
  writeUint32(data, offset + 4, tag.data.length, isLittleEndian);

  if (tag.data.length <= 4) {
    data.set(tag.data, offset + 8);
  } else {
    writeUint32(data, offset + 8, dataOffset ?? 0, isLittleEndian);
  }
}

/** UNICODE encoding prefix for UserComment: "UNICODE\0" */
const UNICODE_PREFIX = new Uint8Array([
  0x55, 0x4e, 0x49, 0x43, 0x4f, 0x44, 0x45, 0x00,
]);

/**
 * Encode string as UserComment with UTF-16LE encoding
 *
 * Uses UNICODE prefix followed by UTF-16LE encoded text.
 *
 * @param text - Text to encode
 * @returns Encoded UserComment data (8-byte prefix + UTF-16LE text)
 */
function encodeUserComment(text: string): Uint8Array {
  const result = new Uint8Array(8 + text.length * 2);
  const dataView = new DataView(result.buffer);

  result.set(UNICODE_PREFIX);
  for (let i = 0; i < text.length; i++) {
    dataView.setUint16(8 + i * 2, text.charCodeAt(i), true);
  }

  return result;
}

/**
 * Encode ASCII tag data with optional prefix
 *
 * @param text - Text content
 * @param prefix - Optional prefix (e.g., "Workflow")
 * @returns Null-terminated ASCII bytes
 */
function encodeAsciiTag(text: string, prefix?: string): Uint8Array {
  const fullText = prefix ? `${prefix}: ${text}` : text;
  const textBytes = new TextEncoder().encode(fullText);
  const result = new Uint8Array(textBytes.length + 1);
  result.set(textBytes, 0);
  result[textBytes.length] = 0;
  return result;
}
