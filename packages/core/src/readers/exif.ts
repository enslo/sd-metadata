/**
 * Exif reading utilities
 *
 * Functions for parsing Exif/TIFF structures and extracting metadata segments.
 */

import type { MetadataSegment } from '../types';
import { readUint16, readUint32 } from '../utils/binary';
import {
  EXIF_IFD_POINTER_TAG,
  IMAGE_DESCRIPTION_TAG,
  MAKE_TAG,
  MODEL_TAG,
  USER_COMMENT_TAG,
} from '../utils/exif-constants';

/**
 * IFD0 ASCII tags that carry generation metadata, mapped to their segment source
 *
 * Tools label the value with the PNG chunk keyword it stands in for, so the
 * prefix identifies the payload while the tag is merely where it landed:
 * - Save Image Extended: ImageDescription "Workflow: ...", Make "Prompt: ..."
 * - Save Animated WEBP (built-in): Model "prompt:...", Make "workflow:..."
 *
 * Save Animated WEBP assigns tags counting down from Make for every
 * extra_pnginfo key, so a second key would land on ImageDescription.
 */
const PREFIXED_TAG_SOURCES: Record<
  number,
  'exifImageDescription' | 'exifMake' | 'exifModel'
> = {
  [IMAGE_DESCRIPTION_TAG]: 'exifImageDescription',
  [MAKE_TAG]: 'exifMake',
  [MODEL_TAG]: 'exifModel',
};

/**
 * Parse Exif TIFF structure and extract all metadata segments
 *
 * Extracts metadata from:
 * - ImageDescription (0x010E), Make (0x010F), Model (0x0110) - see
 *   {@link PREFIXED_TAG_SOURCES}
 * - UserComment (0x9286) - Used by most tools
 *
 * @param exifData - TIFF data (starting with II/MM byte order marker)
 * @returns Array of metadata segments found
 */
export function parseExifMetadataSegments(
  exifData: Uint8Array,
): MetadataSegment[] {
  if (exifData.length < 8) return [];

  // Check TIFF byte order
  const isLittleEndian = exifData[0] === 0x49 && exifData[1] === 0x49; // "II"
  const isBigEndian = exifData[0] === 0x4d && exifData[1] === 0x4d; // "MM"

  if (!isLittleEndian && !isBigEndian) return [];

  // Verify TIFF magic number (42)
  const magic = readUint16(exifData, 2, isLittleEndian);
  if (magic !== 42) return [];

  // Get IFD0 offset
  const ifd0Offset = readUint32(exifData, 4, isLittleEndian);

  // Extract all tags from IFD0
  const ifd0Segments = extractTagsFromIfd(exifData, ifd0Offset, isLittleEndian);

  // Find Exif IFD and extract UserComment from there
  const exifIfdOffset = findExifIfdOffset(exifData, ifd0Offset, isLittleEndian);
  const exifIfdSegments =
    exifIfdOffset !== null
      ? extractTagsFromIfd(exifData, exifIfdOffset, isLittleEndian)
      : [];

  return [...ifd0Segments, ...exifIfdSegments];
}

/**
 * Extract metadata tags from an IFD
 */
function extractTagsFromIfd(
  data: Uint8Array,
  ifdOffset: number,
  isLittleEndian: boolean,
): MetadataSegment[] {
  const segments: MetadataSegment[] = [];

  if (ifdOffset + 2 > data.length) return segments;

  const entryCount = readUint16(data, ifdOffset, isLittleEndian);
  let offset = ifdOffset + 2;

  for (let i = 0; i < entryCount; i++) {
    if (offset + 12 > data.length) return segments;

    const tag = readUint16(data, offset, isLittleEndian);
    const type = readUint16(data, offset + 2, isLittleEndian);
    const count = readUint32(data, offset + 4, isLittleEndian);

    // Calculate data size based on type
    const typeSize = getTypeSize(type);
    const dataSize = count * typeSize;

    // Early bailout for implausibly large data sizes
    if (dataSize > data.length) {
      offset += 12;
      continue;
    }

    let valueOffset: number;
    if (dataSize <= 4) {
      valueOffset = offset + 8;
    } else {
      valueOffset = readUint32(data, offset + 8, isLittleEndian);
    }

    if (valueOffset + dataSize > data.length) {
      offset += 12;
      continue;
    }

    const tagData = data.slice(valueOffset, valueOffset + dataSize);

    // Process known tags
    const prefixedSource = PREFIXED_TAG_SOURCES[tag];
    if (prefixedSource) {
      const text = decodeAsciiString(tagData);
      if (text) {
        const { prefix, body } = splitPrefixedText(text);
        segments.push({
          source: { type: prefixedSource, prefix },
          data: body,
        });
      }
    } else if (tag === USER_COMMENT_TAG) {
      const text = decodeUserComment(tagData);
      if (text) {
        segments.push({
          source: { type: 'exifUserComment' },
          data: text,
        });
      }
    }

    offset += 12;
  }

  return segments;
}

/**
 * Split a labelled tag value like "Workflow: {...}" into prefix and payload
 *
 * The separator varies by tool: Save Image Extended writes "Workflow: {...}"
 * while Save Animated WEBP writes "workflow:{...}". The space is therefore
 * optional, but omitting it only counts in front of a JSON object so that
 * ordinary values such as "http://example.com" keep their text intact.
 *
 * @param text - Decoded tag value
 * @returns Prefix (absent when the value carries no label) and the payload
 */
function splitPrefixedText(text: string): { prefix?: string; body: string } {
  const match = text.match(/^([A-Za-z]+):(?:\s|(?=\{))/);
  if (!match) return { body: text };
  return { prefix: match[1], body: text.slice(match[0].length) };
}

/**
 * Get size in bytes for TIFF data type
 */
function getTypeSize(type: number): number {
  switch (type) {
    case 1:
      return 1; // BYTE
    case 2:
      return 1; // ASCII
    case 3:
      return 2; // SHORT
    case 4:
      return 4; // LONG
    case 5:
      return 8; // RATIONAL
    case 7:
      return 1; // UNDEFINED
    default:
      return 1;
  }
}

/**
 * Decode ASCII/UTF-8 string from tag data
 */
function decodeAsciiString(data: Uint8Array): string | null {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(data);
    // Remove null terminator if present
    if (text.endsWith('\0')) {
      text = text.slice(0, -1);
    }
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Find Exif IFD offset from IFD0
 */
function findExifIfdOffset(
  data: Uint8Array,
  ifdOffset: number,
  isLittleEndian: boolean,
): number | null {
  if (ifdOffset + 2 > data.length) return null;

  const entryCount = readUint16(data, ifdOffset, isLittleEndian);
  let offset = ifdOffset + 2;

  for (let i = 0; i < entryCount; i++) {
    if (offset + 12 > data.length) return null;

    const tag = readUint16(data, offset, isLittleEndian);

    if (tag === EXIF_IFD_POINTER_TAG) {
      // Exif IFD pointer found
      return readUint32(data, offset + 8, isLittleEndian);
    }

    offset += 12;
  }

  return null;
}

/**
 * Decode UserComment based on encoding prefix
 *
 * @param data - UserComment data including encoding prefix
 * @returns Decoded string
 */
export function decodeUserComment(data: Uint8Array): string | null {
  if (data.length < 8) return null;

  // Check for UNICODE prefix
  if (
    data[0] === 0x55 && // U
    data[1] === 0x4e && // N
    data[2] === 0x49 && // I
    data[3] === 0x43 && // C
    data[4] === 0x4f && // O
    data[5] === 0x44 && // D
    data[6] === 0x45 && // E
    data[7] === 0x00 // NULL
  ) {
    // UTF-16 encoded - detect byte order by looking at first character
    const textData = data.slice(8);
    if (textData.length >= 2) {
      const isLikelyLE = textData[0] !== 0x00 && textData[1] === 0x00;
      return isLikelyLE ? decodeUtf16LE(textData) : decodeUtf16BE(textData);
    }
    return decodeUtf16BE(textData);
  }

  // Check for ASCII prefix
  if (
    data[0] === 0x41 && // A
    data[1] === 0x53 && // S
    data[2] === 0x43 && // C
    data[3] === 0x49 && // I
    data[4] === 0x49 && // I
    data[5] === 0x00 && // NULL
    data[6] === 0x00 && // NULL
    data[7] === 0x00 // NULL
  ) {
    // ASCII encoded
    return decodeAscii(data.slice(8));
  }

  // Try UTF-8 (for ComfyUI JSON format without prefix)
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let result = decoder.decode(data);
    // Strip null terminator if present
    if (result.endsWith('\0')) {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Decode UTF-16BE string, stopping at first null character
 */
function decodeUtf16BE(data: Uint8Array): string {
  const decoded = new TextDecoder('utf-16be').decode(data);
  const nullIndex = decoded.indexOf('\0');
  return nullIndex >= 0 ? decoded.slice(0, nullIndex) : decoded;
}

/**
 * Decode UTF-16LE string, stopping at first null character
 */
function decodeUtf16LE(data: Uint8Array): string {
  const decoded = new TextDecoder('utf-16le').decode(data);
  const nullIndex = decoded.indexOf('\0');
  return nullIndex >= 0 ? decoded.slice(0, nullIndex) : decoded;
}

/**
 * Decode ASCII string, stopping at first null byte
 */
function decodeAscii(data: Uint8Array): string {
  const nullIndex = data.indexOf(0);
  const sliced = nullIndex >= 0 ? data.subarray(0, nullIndex) : data;
  return new TextDecoder('ascii').decode(sliced);
}
