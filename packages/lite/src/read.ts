/**
 * Lightweight binary readers for PNG, JPEG, and WebP metadata extraction.
 * Uses DataView API for endian-aware integer reading.
 */

// Entry record: keyword → text value
export type Entries = Record<string, string>;

// Maximum caBX (C2PA) bytes captured. The generator marker sits near the start
// of the box, so clamping bounds memory against a maliciously oversized chunk.
const MAX_CABX = 8 * 1024 * 1024;

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

    // caBX: C2PA Content Credentials. Capture the manifest as a Latin-1 string
    // (1:1 byte view) so extract() can recover the generator name from it.
    if (type === 'caBX') {
      entries.cabx = str(data, offset, Math.min(length, MAX_CABX));
    }

    // eXIf: a TIFF structure like a JPEG APP1 payload (CivitAI PNGs)
    if (type === 'eXIf')
      Object.assign(entries, readExif(data.subarray(offset, offset + length)));

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
          // Skip null + compression flag (1) + method (1), then two null-terminated strings.
          // Without a language terminator the second search starts over from
          // the first byte, and its result is not used.
          const langEnd = data.indexOf(0, nullIdx + 3);
          const transEnd = data.indexOf(0, langEnd + 1);
          if (langEnd >= 0 && transEnd >= 0)
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
 * Extract metadata from JPEG: EXIF UserComment/ImageDescription/Make/Model,
 * COM segment, and APP11 (C2PA) as `cabx`.
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

    // APP1 (EXIF). No length check is needed in front of the identifier:
    // str() reads bytes past the end of the data as NUL, so a file cut short
    // right after "Exif" still matches, but it leaves no TIFF bytes and
    // readExif returns nothing for it.
    if (marker === 0xe1 && str(data, offset + 4, 6) === 'Exif\0\0') {
      Object.assign(
        entries,
        readExif(data.subarray(offset + 10, offset + 2 + segLen)),
      );
    }

    // APP11 (JUMBF): C2PA Content Credentials, captured like the PNG caBX chunk.
    // The 8 bytes after the length are the "JP" identifier, box instance and
    // packet number; continuation packets are appended as they come.
    if (marker === 0xeb)
      entries.cabx = (entries.cabx ?? '') + str(data, offset + 12, segLen - 10);

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
  const entries: Entries = {};
  const firstByte = data[0];
  const le = firstByte === 0x49; // "II" = little-endian (both bytes are identical per TIFF spec)
  const dv = dataview(data);
  // The readers are closures over the byte order, which keeps every call
  // site (and scanIfd's parameter list) short
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);

  // Too short, neither "II" nor "MM", or no TIFF magic (the magic is only
  // read once the length check has passed)
  if (data.length < 8 || (!le && firstByte !== 0x4d) || u16(2) !== 42)
    return entries;

  // Scan IFD entries and call the handler with each tag, its value bytes and
  // the offset they start at.
  const scanIfd = (
    ifdOffset: number,
    handler: (tag: number, tagData: Uint8Array, valOffset: number) => void,
  ) => {
    // `left` counts the entries still to read. The entry count is only read
    // when its two bytes are inside the data, and the scan stops at the
    // first entry that does not fit.
    for (
      let pos = ifdOffset + 2, left = pos > data.length ? 0 : u16(ifdOffset);
      left-- && pos + 12 <= data.length;
      pos += 12
    ) {
      const typeSize = [0, 1, 1, 2, 4, 8, 0, 1][u16(pos + 2)] ?? 1;
      const size = u32(pos + 4) * typeSize;
      const valOffset = size <= 4 ? pos + 8 : u32(pos + 8);

      if (valOffset + size <= data.length)
        handler(
          u16(pos),
          data.subarray(valOffset, valOffset + size),
          valOffset,
        );
    }
  };

  // Scan IFD0 for ImageDescription, Make, Model, UserComment, and Exif IFD pointer
  let exifIfdOffset = 0;
  const handleUserComment = (tagData: Uint8Array) => {
    const text = decodeUserComment(tagData);
    if (text) {
      // Text that is not valid JSON leaves `obj` null and is kept as it is
      const obj = text.startsWith('{') ? parseJson(text) : null;
      const software = obj?.Software;
      const comment = obj?.Comment;
      if (
        typeof software === 'string' &&
        software.startsWith('NovelAI') &&
        typeof comment === 'string'
      ) {
        entries.Software = software;
        entries.Comment = comment;
        // Model name and hash, as in the PNG Source chunk
        entries.Source = obj!.Source as string;
      } else entries.UserComment = text;
    }
  };
  scanIfd(u32(4), (tag, tagData, valOffset) => {
    // ImageDescription (0x010E) through Model (0x0110). Tools label the value
    // with the PNG chunk keyword it stands in for, so the label decides the
    // entry key: save-image-extended writes ImageDescription "Workflow: {...}"
    // and Make "Prompt: {...}", while ComfyUI's built-in Save Animated WEBP
    // writes Make "workflow:{...}" and Model "prompt:{...}".
    if (tag > 0x010d && tag < 0x0111) {
      const text = decodeAscii(tagData);
      if (text) {
        // The space after the colon is optional, but a bare colon only counts
        // in front of JSON so values like "http://..." keep their text.
        const prefixMatch = text.match(/^([A-Za-z]+):(?:\s|(?=\{))/);
        if (prefixMatch) {
          // The label group matched at least one letter
          entries[prefixMatch[1]!] = text.slice(prefixMatch[0].length);
        } else {
          // The three tags are consecutive, in this order
          entries[['ImageDescription', 'Make', 'Model'][tag - 0x010e]!] = text;
        }
      }
    } else if (tag === 0x9286) {
      // UserComment
      handleUserComment(tagData);
    } else if (tag === 0x8769) {
      // Exif IFD pointer
      exifIfdOffset = u32(valOffset);
    }
  });

  // Scan Exif IFD for UserComment (if not already found in IFD0)
  if (exifIfdOffset && !entries.UserComment && !entries.Software) {
    scanIfd(exifIfdOffset, (tag, tagData) => {
      if (tag === 0x9286) handleUserComment(tagData); // UserComment
    });
  }

  return entries;
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

  // A zero second byte means little-endian. The first byte needs no check:
  // when it is zero too, the text starts with a NUL and decodes to "" in
  // either byte order, as does a payload shorter than one character.
  if (prefix === 'UNICODE\0') return decodeUtf16(payload, payload[1] === 0);

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

/**
 * Safely parse JSON, returning null on failure. Lives here because the EXIF
 * reader needs it too; extract.ts imports it.
 */
export function parseJson(
  text: string | undefined,
): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
