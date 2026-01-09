import type { GenerationSoftware, MetadataSegment } from '../types';

/** UserComment tag ID in Exif */
const USER_COMMENT_TAG = 0x9286;

/** ImageDescription tag ID */
const IMAGE_DESCRIPTION_TAG = 0x010e;

/** Make tag ID */
const MAKE_TAG = 0x010f;

/** Exif IFD pointer tag */
const EXIF_IFD_POINTER_TAG = 0x8769;

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
 *
 * @param data - TIFF data
 * @param ifdOffset - Offset to IFD
 * @param isLittleEndian - Byte order
 * @returns Array of metadata segments found in this IFD
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
          data: prefix ? text.slice(prefix.length + 2) : text, // Remove "Prefix: " from data
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
 * Parse Exif TIFF structure and extract UserComment (legacy function)
 *
 * @param exifData - TIFF data (starting with II/MM byte order marker)
 * @returns UserComment text or null if not found
 */
export function parseExifUserComment(exifData: Uint8Array): string | null {
  const segments = parseExifMetadataSegments(exifData);
  // Return first UserComment found
  for (const segment of segments) {
    if (segment.source.type === 'exifUserComment') {
      return segment.data;
    }
  }
  // Fall back to ImageDescription if no UserComment
  for (const segment of segments) {
    if (
      segment.source.type === 'exifImageDescription' ||
      segment.source.type === 'exifMake'
    ) {
      return segment.data;
    }
  }
  return null;
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
    // Standard says BE, but some tools (SwarmUI) use LE
    const textData = data.slice(8);
    if (textData.length >= 2) {
      // If first byte is printable ASCII and second is 0x00, it's likely LE
      // e.g., '{' (0x7B) followed by 0x00 = UTF-16LE
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
    return decoder.decode(data);
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
    if (code === 0) break; // Stop at null terminator
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
    if (code === 0) break; // Stop at null terminator
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
    if (data[i] === 0) break; // Stop at null terminator
    chars.push(String.fromCharCode(data[i] ?? 0));
  }

  return chars.join('');
}

/**
 * Read 16-bit unsigned integer
 */
function readUint16(
  data: Uint8Array,
  offset: number,
  isLittleEndian: boolean,
): number {
  if (isLittleEndian) {
    return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
  }
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

/**
 * Read 32-bit unsigned integer
 */
function readUint32(
  data: Uint8Array,
  offset: number,
  isLittleEndian: boolean,
): number {
  if (isLittleEndian) {
    return (
      (data[offset] ?? 0) |
      ((data[offset + 1] ?? 0) << 8) |
      ((data[offset + 2] ?? 0) << 16) |
      ((data[offset + 3] ?? 0) << 24)
    );
  }
  return (
    ((data[offset] ?? 0) << 24) |
    ((data[offset + 1] ?? 0) << 16) |
    ((data[offset + 2] ?? 0) << 8) |
    (data[offset + 3] ?? 0)
  );
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

    // Check for Civitai JSON format (has civitai: URN or resource-stack)
    if (
      userComment.includes('civitai:') ||
      userComment.includes('"resource-stack"')
    ) {
      return 'civitai';
    }

    // Check for NovelAI JSON format
    // - Direct keys: "v4_prompt", "noise_schedule", "uncond_scale"
    // - WebP metadata format: "Software":"NovelAI" or escaped versions
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

    // Check for ComfyUI JSON format (has "prompt" or "nodes" key for workflow)
    if (userComment.includes('"prompt"') || userComment.includes('"nodes"')) {
      return 'comfyui';
    }
  }

  // A1111-style format detection
  // Check for Version field
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
