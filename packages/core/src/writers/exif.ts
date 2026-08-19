/**
 * Exif writing utilities
 *
 * Functions for building Exif/TIFF structures from metadata segments.
 */

import type { MetadataSegment, MetadataSegmentSource } from '../types';
import { writeUint16, writeUint32 } from '../utils/binary';
import {
  EXIF_IFD_POINTER_TAG,
  IMAGE_DESCRIPTION_TAG,
  MAKE_TAG,
  MODEL_TAG,
  USER_COMMENT_TAG,
} from '../utils/exif-constants';

/**
 * IFD0 ASCII tag each segment source is written back to
 *
 * Mirrors the reader's tag table so a segment returns to the tag it came from.
 */
const IFD0_TAG_BY_SOURCE: Partial<
  Record<MetadataSegmentSource['type'], number>
> = {
  exifImageDescription: IMAGE_DESCRIPTION_TAG,
  exifMake: MAKE_TAG,
  exifModel: MODEL_TAG,
};

/**
 * Build Exif TIFF data from MetadataSegments
 *
 * Creates a complete TIFF structure with IFD0, Exif IFD, and all tag data.
 * Uses big-endian (Motorola) byte order, matching what the A1111 family
 * (sd-webui/Forge/reForge/SD.Next via piexif) writes — see samples/jpg.
 *
 * @param segments - Metadata segments to encode
 * @returns TIFF data (starts with "MM" byte order marker)
 */
export function buildExifTiffData(segments: MetadataSegment[]): Uint8Array {
  // Build tag data for each segment, split by destination IFD
  const ifd0Tags: Array<{ tag: number; type: number; data: Uint8Array }> = [];
  const exifTags: Array<{ tag: number; type: number; data: Uint8Array }> = [];

  for (const seg of segments) {
    const ifd0Tag = IFD0_TAG_BY_SOURCE[seg.source.type];
    if (ifd0Tag !== undefined) {
      const prefix = 'prefix' in seg.source ? seg.source.prefix : undefined;
      const data = encodeAsciiTag(seg.data, prefix);
      ifd0Tags.push({ tag: ifd0Tag, type: 2, data });
    } else if (seg.source.type === 'exifUserComment') {
      const data = encodeUserComment(seg.data);
      exifTags.push({ tag: USER_COMMENT_TAG, type: 7, data });
    }
  }

  // No Exif-type segments
  if (ifd0Tags.length === 0 && exifTags.length === 0) {
    return new Uint8Array(0);
  }

  const isLittleEndian = false;

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
  result[0] = 0x4d; // M
  result[1] = 0x4d; // M (big-endian)
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
  // The count field holds the number of typed values, not bytes —
  // for LONG (type 4) that is data.length / 4
  const typeSize = tag.type === 4 ? 4 : 1;
  writeUint16(data, offset, tag.tag, isLittleEndian);
  writeUint16(data, offset + 2, tag.type, isLittleEndian);
  writeUint32(data, offset + 4, tag.data.length / typeSize, isLittleEndian);

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

/** ASCII encoding prefix for UserComment: "ASCII\0\0\0" */
const ASCII_PREFIX = new Uint8Array([
  0x41, 0x53, 0x43, 0x49, 0x49, 0x00, 0x00, 0x00,
]);

/** Whether every code unit fits in 7-bit ASCII */
function isAsciiOnly(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

/**
 * Encode string as UserComment
 *
 * Pure-ASCII text uses the ASCII prefix: single-byte code units carry no
 * byte-order ambiguity and take half the space (NovelAI writes this shape,
 * without a NUL terminator). Anything else uses the UNICODE prefix with
 * UTF-16BE, matching the A1111 ecosystem — piexif, which A1111's PNG Info
 * uses to read JPEG metadata back, decodes UNICODE comments as UTF-16BE
 * unconditionally.
 *
 * @param text - Text to encode
 * @returns Encoded UserComment data (8-byte prefix + text)
 */
function encodeUserComment(text: string): Uint8Array {
  if (isAsciiOnly(text)) {
    const result = new Uint8Array(8 + text.length);
    result.set(ASCII_PREFIX);
    for (let i = 0; i < text.length; i++) {
      result[8 + i] = text.charCodeAt(i);
    }
    return result;
  }

  const result = new Uint8Array(8 + text.length * 2);
  const dataView = new DataView(result.buffer);

  result.set(UNICODE_PREFIX);
  for (let i = 0; i < text.length; i++) {
    dataView.setUint16(8 + i * 2, text.charCodeAt(i), false);
  }

  return result;
}

/**
 * Prefixes written without a space after the colon, matching ComfyUI's own
 * Save Animated WEBP node byte-for-byte (Python: f"{key}:{json.dumps(value)}").
 * Every other prefix (e.g. save-image-extended's Title Case "Workflow"/
 * "Prompt") keeps the ": " separator, matching that tool's own real-world
 * output — see comfyui-save-image-extended.webp in samples/.
 */
const NO_SPACE_PREFIXES = new Set(['workflow', 'prompt']);

/**
 * Encode ASCII tag data with optional prefix
 *
 * @param text - Text content
 * @param prefix - Optional prefix (e.g., "Workflow")
 * @returns Null-terminated ASCII bytes
 */
function encodeAsciiTag(text: string, prefix?: string): Uint8Array {
  const separator = prefix && NO_SPACE_PREFIXES.has(prefix) ? ':' : ': ';
  const fullText = prefix ? `${prefix}${separator}${text}` : text;
  const textBytes = new TextEncoder().encode(fullText);
  const result = new Uint8Array(textBytes.length + 1);
  result.set(textBytes, 0);
  result[textBytes.length] = 0;
  return result;
}
