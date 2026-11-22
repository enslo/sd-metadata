/**
 * Rewriting an image with nothing but what it takes to display it
 *
 * write() replaces the metadata it manages and passes every other chunk
 * or segment through, as editing metadata should. Stripping asks for the
 * opposite: each format has a short list of what a decoder uses (the
 * image data, transparency, color, animation), and everything else goes,
 * whether this library knows it or not: text chunks, EXIF, XMP, C2PA
 * manifests, vendor blocks, and whatever follows the end of the image.
 *
 * One value is carried over from EXIF, because dropping it would turn the
 * picture on its side: the orientation, written back as an EXIF block
 * holding that single tag.
 */

import { Result } from '../types';
import {
  isJpeg,
  isPng,
  isWebp,
  readChunkType,
  readUint16,
  readUint16BE,
  readUint32,
  readUint32BE,
  readUint32LE,
  writeUint32LE,
} from '../utils/binary';
import { ORIENTATION_TAG } from '../utils/exif-constants';
import { buildChunk } from './png';

/** An image without metadata, or what is wrong with the file */
type EssentialResult = Result<Uint8Array, string>;

// ============================================================================
// PNG
// ============================================================================

const PNG_SIGNATURE_LENGTH = 8;

/**
 * PNG chunks a decoder uses: the image itself, transparency, color
 * interpretation, pixel dimensions, and animation
 */
const PNG_KEPT = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'cHRM',
  'gAMA',
  'iCCP',
  'sBIT',
  'sRGB',
  'cICP',
  'mDCV',
  'cLLI',
  'bKGD',
  'hIST',
  'pHYs',
  'sPLT',
  'acTL',
  'fcTL',
  'fdAT',
]);

/**
 * Rewrite a PNG with only the chunks a decoder uses
 *
 * A critical chunk that is not on the list is kept as well: a decoder must
 * not show an image whose critical chunks it does not know, so removing
 * one would change what the file is. Anything after IEND is dropped.
 *
 * A file that breaks off inside a chunk is refused, as writePngMetadata
 * does: the result would look whole without being so.
 */
export function writeEssentialPng(data: Uint8Array): EssentialResult {
  if (!isPng(data)) {
    return Result.error('Not a PNG file');
  }

  const kept: Uint8Array[] = [];
  let orientation = 1;
  let offset = PNG_SIGNATURE_LENGTH;
  while (offset < data.length) {
    if (offset + 12 > data.length) {
      return Result.error('PNG ends inside a chunk header');
    }
    const length = readUint32BE(data, offset);
    const type = readChunkType(data, offset + 4);
    // Length, type, data and CRC
    const end = offset + 12 + length;
    if (end > data.length) {
      return Result.error(`PNG ends inside a chunk (${type})`);
    }
    if (offset === PNG_SIGNATURE_LENGTH && type !== 'IHDR') {
      return Result.error('PNG does not start with IHDR');
    }

    if (type === 'eXIf' && orientation === 1) {
      orientation = readOrientation(data.subarray(offset + 8, end - 4));
    }
    // Bit 5 of the first letter is clear for a critical chunk
    const critical = ((data[offset + 4] ?? 0) & 0x20) === 0;
    if (PNG_KEPT.has(type) || critical) {
      kept.push(data.subarray(offset, end));
    }
    offset = end;
    if (type === 'IEND') {
      break;
    }
  }

  const [ihdr, ...rest] = kept;
  if (!ihdr) {
    return Result.error('PNG has no IHDR chunk');
  }
  return Result.ok(
    concat([
      data.subarray(0, PNG_SIGNATURE_LENGTH),
      ihdr,
      ...(orientation === 1
        ? []
        : [buildChunk('eXIf', orientationTiff(orientation))]),
      ...rest,
    ]),
  );
}

// ============================================================================
// JPEG
// ============================================================================

const SOI = new Uint8Array([0xff, 0xd8]);
const EOI = new Uint8Array([0xff, 0xd9]);

const MARKER_APP0 = 0xe0;
const MARKER_APP1 = 0xe1;
const MARKER_APP2 = 0xe2;
const MARKER_APP14 = 0xee;
const MARKER_APP15 = 0xef;
const MARKER_COM = 0xfe;
const MARKER_SOS = 0xda;
const MARKER_EOI = 0xd9;

const EXIF_IDENTIFIER = 'Exif\0\0';

/**
 * Rewrite a JPEG with only the segments a decoder uses
 *
 * Metadata lives in the application segments (APP0-APP15) and comments.
 * Of those, three are kept because the decoded picture depends on them:
 * the JFIF header (pixel density), the ICC profile (color), and Adobe's
 * APP14 (which color transform the data went through). Every other marker
 * is image structure and stays. The walk goes through the scans as well,
 * so a comment between two scans is dropped too, and it ends at the end
 * of the image: anything after EOI is left out.
 */
export function writeEssentialJpeg(data: Uint8Array): EssentialResult {
  if (!isJpeg(data)) {
    return Result.error('Not a JPEG file');
  }

  const kept: Uint8Array[] = [];
  let orientation = 1;
  let sawScan = false;
  let offset = 2;
  while (offset + 1 < data.length) {
    if (data[offset] !== 0xff) {
      return Result.error(`JPEG has no marker at offset ${offset}`);
    }
    const marker = data[offset + 1] ?? 0;
    if (marker === 0xff) {
      // A fill byte before the marker
      offset++;
      continue;
    }
    if (marker === MARKER_EOI) {
      kept.push(EOI);
      break;
    }
    // Markers that stand alone: TEM, and a restart marker out of place
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(data.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (offset + 4 > data.length) {
      return Result.error('JPEG ends inside a segment header');
    }
    const length = readUint16BE(data, offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > data.length) {
      return Result.error('JPEG ends inside a segment');
    }
    const segment = data.subarray(offset, end);

    if (marker === MARKER_SOS) {
      // The scan header and the entropy-coded data after it
      const next = endOfScan(data, end);
      kept.push(data.subarray(offset, next));
      sawScan = true;
      offset = next;
      continue;
    }

    const application = marker >= MARKER_APP0 && marker <= MARKER_APP15;
    if (
      marker === MARKER_APP1 &&
      orientation === 1 &&
      hasIdentifier(segment, EXIF_IDENTIFIER)
    ) {
      orientation = readOrientation(
        segment.subarray(4 + EXIF_IDENTIFIER.length),
      );
    }
    if (
      application
        ? keepsApplicationSegment(marker, segment)
        : marker !== MARKER_COM
    ) {
      kept.push(segment);
    }
    offset = end;
  }

  if (!sawScan) {
    return Result.error('JPEG has no image data');
  }
  return Result.ok(
    concat([
      SOI,
      ...(orientation === 1 ? [] : [buildExifSegment(orientation)]),
      ...kept,
    ]),
  );
}

/**
 * Offset of the first marker after a scan's entropy-coded data
 *
 * Inside that data a 0xFF byte is followed by 0x00 (a literal 0xFF) or by
 * a restart marker; any other pair is the next marker. Returns the end of
 * the data when the file ends first.
 */
function endOfScan(data: Uint8Array, from: number): number {
  let at = from;
  for (;;) {
    at = data.indexOf(0xff, at);
    if (at < 0 || at + 1 >= data.length) {
      return data.length;
    }
    const next = data[at + 1] ?? 0;
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
      at += 2;
    } else if (next === 0xff) {
      at += 1;
    } else {
      return at;
    }
  }
}

/** Whether an application segment is one the decoded picture depends on */
function keepsApplicationSegment(marker: number, segment: Uint8Array): boolean {
  switch (marker) {
    case MARKER_APP0:
      // The JFIF header, not its JFXX extension (an embedded thumbnail)
      return hasIdentifier(segment, 'JFIF\0');
    case MARKER_APP2:
      return hasIdentifier(segment, 'ICC_PROFILE\0');
    case MARKER_APP14:
      return hasIdentifier(segment, 'Adobe');
    default:
      return false;
  }
}

/** Whether a segment's payload opens with the given ASCII identifier */
function hasIdentifier(segment: Uint8Array, identifier: string): boolean {
  if (segment.length < 4 + identifier.length) {
    return false;
  }
  for (let i = 0; i < identifier.length; i++) {
    if (segment[4 + i] !== identifier.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

/** An APP1 Exif segment that holds the orientation and nothing else */
function buildExifSegment(orientation: number): Uint8Array {
  const tiff = orientationTiff(orientation);
  const length = 2 + EXIF_IDENTIFIER.length + tiff.length;
  const segment = new Uint8Array(2 + length);
  segment.set([0xff, MARKER_APP1, length >> 8, length & 0xff]);
  for (let i = 0; i < EXIF_IDENTIFIER.length; i++) {
    segment[4 + i] = EXIF_IDENTIFIER.charCodeAt(i);
  }
  segment.set(tiff, 4 + EXIF_IDENTIFIER.length);
  return segment;
}

// ============================================================================
// WebP
// ============================================================================

/** WebP chunks a decoder uses: header, image data, color, and animation */
const WEBP_KEPT = new Set([
  'VP8X',
  'VP8 ',
  'VP8L',
  'ALPH',
  'ICCP',
  'ANIM',
  'ANMF',
]);

const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

/**
 * Rewrite a WebP with only the chunks a decoder uses
 *
 * The VP8X header keeps its color profile, alpha and animation flags; the
 * EXIF and XMP flags follow what the result holds. Bytes past the size the
 * RIFF header declares are dropped.
 */
export function writeEssentialWebp(data: Uint8Array): EssentialResult {
  if (!isWebp(data)) {
    return Result.error('Not a WebP file');
  }

  const chunks: Uint8Array[] = [];
  let orientation = 1;
  // "RIFF" and the size field come before what the size counts
  const riffEnd = Math.min(data.length, 8 + readUint32LE(data, 4));
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const type = readChunkType(data, offset);
    const size = readUint32LE(data, offset + 4);
    const end = offset + 8 + size;
    if (end > data.length) {
      return Result.error(`WebP ends inside a chunk (${type})`);
    }
    if (type === 'EXIF' && orientation === 1) {
      // Some writers put the "Exif\0\0" of a JPEG segment before the TIFF data
      const payload = data.subarray(offset + 8, end);
      const prefixed = EXIF_IDENTIFIER.split('').every(
        (char, i) => payload[i] === char.charCodeAt(0),
      );
      orientation = readOrientation(
        prefixed ? payload.subarray(EXIF_IDENTIFIER.length) : payload,
      );
    }
    if (WEBP_KEPT.has(type)) {
      chunks.push(padded(data.subarray(offset, end)));
    }
    // RIFF chunks are padded to even byte boundaries
    offset = end + (size % 2);
  }

  // Only the extended format carries EXIF: without a VP8X header there
  // is no orientation a decoder would have applied
  const [first, ...rest] = chunks;
  const extended = first !== undefined && readChunkType(first, 0) === 'VP8X';
  const exif =
    extended && orientation !== 1
      ? riffChunk('EXIF', orientationTiff(orientation))
      : null;
  const ordered =
    extended && first.length > 8
      ? [withMetadataFlags(first, exif ? VP8X_EXIF_FLAG : 0), ...rest]
      : chunks;
  if (exif) {
    ordered.push(exif);
  }

  const body = concat(ordered);
  const out = new Uint8Array(12 + body.length);
  out.set(data.subarray(0, 4), 0); // "RIFF"
  writeUint32LE(out, 4, 4 + body.length);
  out.set(data.subarray(8, 12), 8); // "WEBP"
  out.set(body, 12);
  return Result.ok(out);
}

/** Copy of a VP8X chunk whose EXIF and XMP flags are replaced by `flags` */
function withMetadataFlags(vp8x: Uint8Array, flags: number): Uint8Array {
  const copy = vp8x.slice();
  copy[8] = ((copy[8] ?? 0) & ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG)) | flags;
  return copy;
}

/** A RIFF chunk: FourCC, size, payload, and a pad byte for an odd size */
export function riffChunk(type: string, payload: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(8 + payload.length + (payload.length % 2));
  for (let i = 0; i < 4; i++) {
    chunk[i] = type.charCodeAt(i);
  }
  writeUint32LE(chunk, 4, payload.length);
  chunk.set(payload, 8);
  return chunk;
}

/** The chunk with its pad byte, added when the file ends without it */
function padded(chunk: Uint8Array): Uint8Array {
  if (chunk.length % 2 === 0) {
    return chunk;
  }
  const out = new Uint8Array(chunk.length + 1);
  out.set(chunk);
  return out;
}

// ============================================================================
// Orientation
// ============================================================================

/**
 * Orientation of an image from its EXIF data (TIFF structure)
 *
 * @returns 2-8 for a picture stored turned or mirrored, 1 otherwise: the
 *   default, also given for missing or malformed data
 */
function readOrientation(tiff: Uint8Array): number {
  const little = tiff[0] === 0x49 && tiff[1] === 0x49; // "II"
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d; // "MM"
  if (!little && !big) {
    return 1;
  }
  // Out-of-range reads count as zero, which ends the search
  const u16 = (at: number) =>
    at + 2 <= tiff.length ? readUint16(tiff, at, little) : 0;
  const u32 = (at: number) =>
    at + 4 <= tiff.length ? readUint32(tiff, at, little) : 0;
  if (u16(2) !== 42) {
    return 1;
  }

  const directory = u32(4);
  const entries = u16(directory);
  for (let i = 0; i < entries; i++) {
    // Tag (2), type (2), count (4), value (4)
    const entry = directory + 2 + i * 12;
    if (u16(entry) !== ORIENTATION_TAG) {
      continue;
    }
    // One SHORT, stored in the entry itself
    const value =
      u16(entry + 2) === 3 && u32(entry + 4) === 1 ? u16(entry + 8) : 1;
    return value >= 2 && value <= 8 ? value : 1;
  }
  return 1;
}

/** EXIF data (TIFF structure) holding the orientation and nothing else */
function orientationTiff(orientation: number): Uint8Array {
  return new Uint8Array([
    // Header: little-endian, magic 42, first directory at offset 8
    0x49,
    0x49,
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00,
    // One entry
    0x01,
    0x00,
    // Orientation, SHORT, count 1, value
    0x12,
    0x01,
    0x03,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    // No further directory
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
