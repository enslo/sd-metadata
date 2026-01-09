/**
 * Exif reading utilities
 *
 * Functions for parsing Exif/TIFF structures and extracting metadata segments.
 */

import type { GenerationSoftware, MetadataSegment } from '../types';
import { readUint16, readUint32 } from '../utils/binary';
import {
  EXIF_IFD_POINTER_TAG,
  IMAGE_DESCRIPTION_TAG,
  MAKE_TAG,
  USER_COMMENT_TAG,
} from '../utils/exif-constants';

/**
 * Parse Exif TIFF structure and extract all metadata segments
 *
 * Extracts metadata from:
 * - ImageDescription (0x010E) - Used by ComfyUI Save Image Extended (with "Workflow:" prefix)
 * - Make (0x010F) - Used by ComfyUI Save Image Extended (with "Prompt:" prefix)
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
    if (tag === IMAGE_DESCRIPTION_TAG) {
      const text = decodeAsciiString(tagData);
      if (text) {
        const prefix = extractPrefix(text);
        segments.push({
          source: { type: 'exifImageDescription', prefix: prefix ?? undefined },
          data: prefix ? text.slice(prefix.length + 2) : text,
        });
      }
    } else if (tag === MAKE_TAG) {
      const text = decodeAsciiString(tagData);
      if (text) {
        const prefix = extractPrefix(text);
        segments.push({
          source: { type: 'exifMake', prefix: prefix ?? undefined },
          data: prefix ? text.slice(prefix.length + 2) : text,
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
 * Extract prefix from text like "Workflow: {...}" -> "Workflow"
 */
function extractPrefix(text: string): string | null {
  const match = text.match(/^([A-Za-z]+):\s/);
  return match?.[1] ?? null;
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
 * Decode UTF-16BE string
 */
function decodeUtf16BE(data: Uint8Array): string {
  const chars: string[] = [];

  for (let i = 0; i < data.length - 1; i += 2) {
    const code = ((data[i] ?? 0) << 8) | (data[i + 1] ?? 0);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }

  return chars.join('');
}

/**
 * Decode UTF-16LE string
 */
function decodeUtf16LE(data: Uint8Array): string {
  const chars: string[] = [];

  for (let i = 0; i < data.length - 1; i += 2) {
    const code = (data[i] ?? 0) | ((data[i + 1] ?? 0) << 8);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }

  return chars.join('');
}

/**
 * Decode ASCII string
 */
function decodeAscii(data: Uint8Array): string {
  const chars: string[] = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) break;
    chars.push(String.fromCharCode(data[i] ?? 0));
  }

  return chars.join('');
}

/**
 * Detect generation software from UserComment or COM segment content
 *
 * @param userComment - Decoded UserComment/comment string
 * @returns Detected software or null
 */
export function detectSoftware(userComment: string): GenerationSoftware | null {
  // Check for JSON format (starts with {)
  if (userComment.startsWith('{')) {
    // Check for SwarmUI first (has sui_image_params)
    if (userComment.includes('sui_image_params')) {
      return 'swarmui';
    }

    // Check for Civitai JSON format
    if (
      userComment.includes('civitai:') ||
      userComment.includes('"resource-stack"')
    ) {
      return 'civitai';
    }

    // Check for NovelAI JSON format
    if (
      userComment.includes('"v4_prompt"') ||
      userComment.includes('"noise_schedule"') ||
      userComment.includes('"uncond_scale"') ||
      userComment.includes('"Software":"NovelAI"') ||
      userComment.includes('\\"noise_schedule\\"') ||
      userComment.includes('\\"v4_prompt\\"')
    ) {
      return 'novelai';
    }

    // Check for ComfyUI JSON format
    if (userComment.includes('"prompt"') || userComment.includes('"nodes"')) {
      return 'comfyui';
    }
  }

  // A1111-style format detection
  const versionMatch = userComment.match(/Version:\s*([^\s,]+)/);
  if (versionMatch) {
    const version = versionMatch[1];
    if (version === 'neo' || version?.startsWith('neo')) {
      return 'forge-neo';
    }
    if (version?.startsWith('f') && /^f\d/.test(version)) {
      return 'forge';
    }
    if (version === 'ComfyUI') {
      return 'comfyui';
    }
  }

  // Check for Civitai resources
  if (userComment.includes('Civitai resources:')) {
    return 'civitai';
  }

  // Check for swarm_version in JSON params
  if (userComment.includes('swarm_version')) {
    return 'swarmui';
  }

  // Default to A1111 format if it has typical parameters
  if (userComment.includes('Steps:') && userComment.includes('Sampler:')) {
    return 'sd-webui';
  }

  return null;
}
