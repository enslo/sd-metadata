/**
 * Lightweight binary readers for PNG, JPEG, and WebP metadata extraction.
 * Uses DataView API for endian-aware integer reading.
 */

// Entry record: keyword → text value
export type Entries = Record<string, string>;

// ============================================================================
// PNG Reader
// ============================================================================

/**
 * Extract text chunks from PNG data as keyword→text entries.
 */
export function readPng(data: Uint8Array): Entries {
  const entries: Entries = {};
  const dv = dataview(data);
  let offset = 8; // Skip PNG signature

  while (offset + 8 <= data.length) {
    const length = dv.getUint32(offset);
    const type = str(data, offset + 4, 4);
    offset += 8;

    if (offset + length > data.length) break;

    if (type === 'tEXt' || type === 'iTXt') {
      const nullIdx = data.indexOf(0, offset);
      if (nullIdx > offset && nullIdx < offset + length) {
        const keyword = str(data, offset, nullIdx - offset);
        if (type === 'tEXt') {
          const textData = data.subarray(nullIdx + 1, offset + length);
          entries[keyword] =
            tryUtf8(textData) ??
            str(data, nullIdx + 1, offset + length - nullIdx - 1);
        } else {
          // Skip null + compression flag (1) + method (1), then two null-terminated strings
          const pos = nullIdx + 3;
          const langEnd = data.indexOf(0, pos);
          const transEnd = langEnd < 0 ? -1 : data.indexOf(0, langEnd + 1);
          if (langEnd < 0 || transEnd < 0) {
            offset += length + 4;
            continue;
          }
          entries[keyword] =
            tryUtf8(data.subarray(transEnd + 1, offset + length)) ?? '';
        }
      }
    }

    if (type === 'IEND') break;
    offset += length + 4; // Skip data + CRC
  }

  return entries;
}

// ============================================================================
// JPEG Reader
// ============================================================================

/**
 * Extract metadata from JPEG: EXIF UserComment/ImageDescription/Make + COM segment.
 */
export function readJpeg(data: Uint8Array): Entries {
  const entries: Entries = {};
  let offset = 2; // Skip SOI

  while (offset + 4 <= data.length) {
    const marker = data[offset + 1]!;
    if (data[offset] !== 0xff || marker === 0xff) {
      offset++;
      continue;
    }

    // SOS (0xDA) or EOI (0xD9) — stop scanning
    if (marker > 0xd8 && marker < 0xdb) break;

    const segLen = (data[offset + 2]! << 8) | data[offset + 3]!;

    // APP1 (EXIF)
    if (
      marker === 0xe1 &&
      offset + 10 <= data.length &&
      str(data, offset + 4, 6) === 'Exif\0\0'
    ) {
      Object.assign(
        entries,
        readExif(data.subarray(offset + 10, offset + 2 + segLen)),
      );
    }

    // COM segment
    if (marker === 0xfe) {
      const comData = data.subarray(offset + 4, offset + 2 + segLen);
      const text = tryUtf8(comData);
      if (text) entries.Comment = text;
    }

    offset += 2 + segLen;
  }

  return entries;
}

// ============================================================================
// WebP Reader
// ============================================================================

/**
 * Extract metadata from WebP: EXIF chunk → same EXIF parsing as JPEG.
 */
export function readWebp(data: Uint8Array): Entries {
  const dv = dataview(data);
  let offset = 12; // Skip RIFF header

  while (offset + 8 <= data.length) {
    const type = str(data, offset, 4);
    const chunkSize = dv.getUint32(offset + 4, true); // little-endian
    offset += 8;

    if (type === 'EXIF' && offset + chunkSize <= data.length) {
      return readExif(data.subarray(offset, offset + chunkSize));
    }

    // RIFF chunks are padded to even byte boundaries
    offset += chunkSize + (chunkSize % 2);
  }

  return {};
}

// ============================================================================
// EXIF / TIFF Parser
// ============================================================================

/**
 * Parse EXIF/TIFF data and extract metadata entries.
 */
function readExif(data: Uint8Array): Entries {
  if (data.length < 8) return {};

  const firstByte = data[0];
  const le = firstByte === 0x49; // "II" = little-endian (both bytes are identical per TIFF spec)
  if (!le && firstByte !== 0x4d) return {}; // Not "MM" either

  const dv = dataview(data);
  if (dv.getUint16(2, le) !== 42) return {}; // TIFF magic

  const entries: Entries = {};
  const ifd0 = dv.getUint32(4, le);

  // Scan IFD0 for ImageDescription, Make, UserComment, and Exif IFD pointer
  let exifIfdOffset = 0;
  const handleUserComment = (tagData: Uint8Array) => {
    const text = decodeUserComment(tagData);
    if (text) {
      if (text.startsWith('{')) {
        try {
          const obj = JSON.parse(text) as Record<string, unknown>;
          const software = obj.Software;
          const comment = obj.Comment;
          if (
            typeof software === 'string' &&
            software.startsWith('NovelAI') &&
            typeof comment === 'string'
          ) {
            entries.Software = software;
            entries.Comment = comment;
            return;
          }
        } catch {
          // Not valid JSON — fall through to UserComment assignment.
        }
      }
      entries.UserComment = text;
    }
  };
  scanIfd(data, dv, ifd0, le, (tag, tagData) => {
    if (tag === 0x010e || tag === 0x010f) {
      // ImageDescription (0x010E) or Make (0x010F)
      const text = decodeAscii(tagData);
      if (text) {
        const prefixMatch = text.match(/^([A-Za-z]+):\s/);
        if (prefixMatch) {
          const key = prefixMatch[1];
          if (key) entries[key] = text.slice(prefixMatch[0].length);
        } else {
          entries[tag === 0x010e ? 'ImageDescription' : 'Make'] = text;
        }
      }
    } else if (tag === 0x9286) {
      // UserComment
      handleUserComment(tagData);
    } else if (tag === 0x8769) {
      // Exif IFD pointer
      exifIfdOffset = dv.getUint32(tagData.byteOffset - data.byteOffset, le);
    }
  });

  // Scan Exif IFD for UserComment (if not already found in IFD0)
  if (exifIfdOffset && !entries.UserComment && !entries.Software) {
    scanIfd(data, dv, exifIfdOffset, le, (tag, tagData) => {
      if (tag === 0x9286) handleUserComment(tagData); // UserComment
    });
  }

  return entries;
}

/**
 * Scan IFD entries and call handler for each tag.
 */
function scanIfd(
  data: Uint8Array,
  dv: DataView,
  ifdOffset: number,
  le: boolean,
  handler: (tag: number, tagData: Uint8Array) => void,
): void {
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  if (ifdOffset + 2 > data.length) return;
  const count = u16(ifdOffset);
  let pos = ifdOffset + 2;

  for (let i = 0; i < count; i++) {
    if (pos + 12 > data.length) return;
    const tag = u16(pos);
    const type = u16(pos + 2);
    const valueCount = u32(pos + 4);
    const typeSize = [0, 1, 1, 2, 4, 8, 0, 1][type] ?? 1;
    const size = valueCount * typeSize;
    const valOffset = size <= 4 ? pos + 8 : u32(pos + 8);

    if (valOffset + size <= data.length) {
      handler(tag, data.subarray(valOffset, valOffset + size));
    }
    pos += 12;
  }
}

// ============================================================================
// String Decoders
// ============================================================================

// Shared DataView constructor — the 48-character expression appears 3x
// (readPng, readWebp, readExif). A helper saves ~61 bytes minified.
function dataview(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

const utf8Dec = new TextDecoder('utf-8', { fatal: true });

// Alias for String.fromCharCode — used in str and decodeUtf16.
// Saves ~38 bytes in the minified IIFE.
const fromCharCode = String.fromCharCode;

function str(data: Uint8Array, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += fromCharCode(data[offset + i]!);
  return s;
}

function tryUtf8(data: Uint8Array): string | null {
  try {
    return utf8Dec.decode(data).replace(/\0$/, '');
  } catch {
    return null;
  }
}

function decodeAscii(data: Uint8Array): string | null {
  const nullIdx = data.indexOf(0);
  return str(data, 0, nullIdx < 0 ? data.length : nullIdx).trim() || null;
}

/**
 * Decode UserComment with encoding prefix detection.
 */
function decodeUserComment(data: Uint8Array): string | null {
  if (data.length < 8) return null;

  const prefix = str(data, 0, 8);
  const payload = data.subarray(8);

  if (prefix === 'UNICODE\0') {
    if (payload.length < 2) return null;
    const isLE = payload[0] !== 0 && payload[1] === 0;
    return decodeUtf16(payload, isLE);
  }

  if (prefix === 'ASCII\0\0\0') {
    return decodeAscii(payload);
  }

  // Try raw UTF-8
  return tryUtf8(data);
}

function decodeUtf16(data: Uint8Array, le: boolean): string {
  let s = '';
  for (let i = 0; i + 1 < data.length; i += 2) {
    const code = le
      ? data[i]! | (data[i + 1]! << 8)
      : (data[i]! << 8) | data[i + 1]!;
    if (!code) break;
    s += fromCharCode(code);
  }
  return s;
}
