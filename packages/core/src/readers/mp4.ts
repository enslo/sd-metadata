/**
 * MP4 / MOV (ISO BMFF) metadata reader
 *
 * Walks the top-level boxes by their headers alone, skipping the media data
 * (`mdat`), and reads only the boxes that hold metadata:
 *
 * - `moov/udta`: `meta` with `keys` + `ilst` (mdta tags written by ffmpeg
 *   with `use_metadata_tags`, e.g. ComfyUI's `workflow` / `prompt`), `meta`
 *   with an atom-typed `ilst` (iTunes style, e.g. `desc`, `©too`), and
 *   QuickTime text items directly in `udta` (e.g. `©swr`)
 * - `moov/trak`: `tkhd` of the video track (`hdlr` type `vide`) for size
 * - top-level `uuid` boxes: the C2PA manifest store and the XMP packet
 */

import type { VideoTag } from '../types';
import { readChunkType, readUint32BE } from '../utils/binary';
import type { ByteSource } from './byte-source';
import { MAX_BODY_READ, type VideoContainer } from './video-container';

/** `uuid` box user type of a C2PA manifest store in ISO BMFF. */
const C2PA_UUID = 'd8fec3d61b0e483c92975828877ec481';

/** `uuid` box user type of an XMP packet. */
const XMP_UUID = 'be7acfcb97a942e89c71999491e3afac';

/** `data` box type indicator for UTF-8 text. */
const DATA_TYPE_UTF8 = 1;

/** A box located in the file or in a byte array. */
interface Box {
  type: string;
  start: number;
  contentStart: number;
  end: number;
}

/**
 * Read an ISO BMFF file, or return `null` when it does not start with an
 * `ftyp` box.
 */
export async function readMp4(
  source: ByteSource,
): Promise<VideoContainer | null> {
  const ftyp = await readBoxAt(source, 0, source.size);
  if (ftyp?.type !== 'ftyp') return null;
  const brand = latin1(await source.read(ftyp.contentStart, 4));

  const container: VideoContainer = {
    format: brand === 'qt  ' ? 'mov' : 'mp4',
    tags: [],
    width: 0,
    height: 0,
  };

  let seenMoov = false;
  for (
    let box = await readBoxAt(source, 0, source.size);
    box;
    box = await readBoxAt(source, box.end, source.size)
  ) {
    if (box.type === 'moov' && !seenMoov) {
      seenMoov = true;
      await readMoov(source, box, container);
    } else if (box.type === 'uuid') {
      await readUuid(source, box, container);
    }
  }

  return container;
}

// ============================================================================
// moov
// ============================================================================

async function readMoov(
  source: ByteSource,
  moov: Box,
  container: VideoContainer,
): Promise<void> {
  for await (const child of boxesIn(source, moov)) {
    if (child.type === 'udta') {
      const udta = await readBody(source, child);
      if (udta) container.tags.push(...readUdta(udta));
    } else if (child.type === 'trak' && container.width === 0) {
      const size = await readVideoTrackSize(source, child);
      if (size) {
        container.width = size.width;
        container.height = size.height;
      }
    }
  }
}

/**
 * Size of a video track: its `tkhd` width and height, when `mdia/hdlr`
 * says the track is video.
 */
async function readVideoTrackSize(
  source: ByteSource,
  trak: Box,
): Promise<{ width: number; height: number } | null> {
  let tkhd: Uint8Array | null = null;
  let isVideo = false;

  for await (const child of boxesIn(source, trak)) {
    if (child.type === 'tkhd') {
      tkhd = await readBody(source, child);
    } else if (child.type === 'mdia') {
      for await (const mdiaChild of boxesIn(source, child)) {
        if (mdiaChild.type !== 'hdlr') continue;
        // FullBox header (4), pre_defined / component type (4), handler type
        const handler = await source.read(mdiaChild.contentStart + 8, 4);
        isVideo = latin1(handler) === 'vide';
      }
    }
  }

  // Width and height are the last 8 bytes (16.16 fixed point) in both
  // tkhd versions.
  if (!isVideo || !tkhd || tkhd.length < 8) return null;
  const width = Math.floor(readUint32BE(tkhd, tkhd.length - 8) / 0x10000);
  const height = Math.floor(readUint32BE(tkhd, tkhd.length - 4) / 0x10000);
  return width > 0 && height > 0 ? { width, height } : null;
}

// ============================================================================
// udta
// ============================================================================

/**
 * Tags in a `udta` body: `meta` boxes and QuickTime text items.
 */
function readUdta(udta: Uint8Array): VideoTag[] {
  const tags: VideoTag[] = [];
  for (const box of boxesInBytes(udta, 0, udta.length)) {
    if (box.type === 'meta') {
      tags.push(...readMeta(udta, box));
    } else if (udta[box.start + 4] === 0xa9) {
      const text = readQuickTimeText(udta, box);
      if (text !== null) {
        tags.push({ key: box.type, value: text, source: 'quicktime' });
      }
    }
  }
  return tags;
}

/**
 * QuickTime user data text item: a 2-byte length, a 2-byte language code,
 * then the text. Only the first entry is read.
 */
function readQuickTimeText(bytes: Uint8Array, box: Box): string | null {
  const start = box.contentStart;
  if (start + 4 > box.end) return null;
  const length = ((bytes[start] ?? 0) << 8) | (bytes[start + 1] ?? 0);
  const textStart = start + 4;
  if (textStart + length > box.end) return null;
  return utf8(bytes.subarray(textStart, textStart + length));
}

/**
 * Tags in a `meta` box: `ilst` items named by `keys` (mdta) or by their
 * atom type (iTunes). ISO `meta` is a FullBox (4-byte version and flags
 * before the children); QuickTime `meta` is not, which shows as a child box
 * type right after the header.
 */
function readMeta(bytes: Uint8Array, meta: Box): VideoTag[] {
  const fullBox = readChunkType(bytes, meta.contentStart + 4) !== 'hdlr';
  const childStart = meta.contentStart + (fullBox ? 4 : 0);

  let keys: string[] = [];
  const tags: VideoTag[] = [];
  for (const box of boxesInBytes(bytes, childStart, meta.end)) {
    if (box.type === 'keys') keys = readKeys(bytes, box);
    if (box.type === 'ilst') tags.push(...readIlst(bytes, box, keys));
  }
  return tags;
}

/** Key names of a `keys` box (FullBox, entry count, then sized entries). */
function readKeys(bytes: Uint8Array, box: Box): string[] {
  const keys: string[] = [];
  const count = readUint32BE(bytes, box.contentStart + 4);
  let offset = box.contentStart + 8;
  for (let i = 0; i < count && offset + 8 <= box.end; i++) {
    const size = readUint32BE(bytes, offset);
    if (size < 8 || offset + size > box.end) break;
    // Entry: size (4), namespace (4, "mdta"), name
    keys.push(utf8(bytes.subarray(offset + 8, offset + size)));
    offset += size;
  }
  return keys;
}

/**
 * Text items of an `ilst` box. An item's box type is a 1-based index into
 * `keys` when keys exist, otherwise an atom type such as `desc`.
 */
function readIlst(bytes: Uint8Array, ilst: Box, keys: string[]): VideoTag[] {
  const tags: VideoTag[] = [];
  for (const item of boxesInBytes(bytes, ilst.contentStart, ilst.end)) {
    const value = readDataText(bytes, item);
    if (value === null) continue;

    const index = readUint32BE(bytes, item.start + 4);
    const key = keys.length > 0 ? keys[index - 1] : undefined;
    tags.push(
      key !== undefined
        ? { key, value, source: 'mdta' }
        : { key: item.type, value, source: 'itunes' },
    );
  }
  return tags;
}

/**
 * UTF-8 value of an item's `data` box: type indicator (4), locale (4),
 * value. Other value types (images, integers) return `null`.
 */
function readDataText(bytes: Uint8Array, item: Box): string | null {
  for (const box of boxesInBytes(bytes, item.contentStart, item.end)) {
    if (box.type !== 'data' || box.contentStart + 8 > box.end) continue;
    const type = readUint32BE(bytes, box.contentStart) & 0xffffff;
    if (type !== DATA_TYPE_UTF8) return null;
    return utf8(bytes.subarray(box.contentStart + 8, box.end));
  }
  return null;
}

// ============================================================================
// uuid
// ============================================================================

/**
 * Top-level `uuid` box: a C2PA manifest store or an XMP packet.
 *
 * The C2PA body is a FullBox header (4), the purpose string ("manifest",
 * null-terminated), an 8-byte offset, then the JUMBF store.
 */
async function readUuid(
  source: ByteSource,
  box: Box,
  container: VideoContainer,
): Promise<void> {
  if (box.contentStart + 16 > box.end) return;
  const userType = hex(await source.read(box.contentStart, 16));
  if (userType !== C2PA_UUID && userType !== XMP_UUID) return;

  const body = await readBody(source, {
    ...box,
    contentStart: box.contentStart + 16,
  });
  if (!body) return;

  if (userType === XMP_UUID) {
    container.xmp ??= utf8(body);
    return;
  }

  const purposeEnd = body.indexOf(0, 4);
  if (purposeEnd < 0 || latin1(body.subarray(4, purposeEnd)) !== 'manifest') {
    return;
  }
  container.c2paStore ??= body.subarray(purposeEnd + 1 + 8);
}

// ============================================================================
// Boxes
// ============================================================================

/**
 * Header of the box at `offset`, or `null` past `limit` or when malformed.
 * A 64-bit size (size field 1) and size 0 ("to the end") are supported.
 */
async function readBoxAt(
  source: ByteSource,
  offset: number,
  limit: number,
): Promise<Box | null> {
  if (offset + 8 > limit) return null;
  const header = await source.read(offset, 16);
  return parseBoxHeader(header, 0, offset, limit);
}

/** The boxes directly inside a box, read header by header. */
async function* boxesIn(source: ByteSource, parent: Box): AsyncGenerator<Box> {
  for (
    let box = await readBoxAt(source, parent.contentStart, parent.end);
    box;
    box = await readBoxAt(source, box.end, parent.end)
  ) {
    yield box;
  }
}

/** The boxes directly inside `[start, end)` of a byte array. */
function* boxesInBytes(
  bytes: Uint8Array,
  start: number,
  end: number,
): Generator<Box> {
  for (
    let box = parseBoxHeader(bytes, start, start, end);
    box;
    box = parseBoxHeader(bytes, box.end, box.end, end)
  ) {
    yield box;
  }
}

/**
 * Parse a box header found at `bytes[at]`, describing a box that starts at
 * `offset` (in the same coordinates as `limit`).
 */
function parseBoxHeader(
  bytes: Uint8Array,
  at: number,
  offset: number,
  limit: number,
): Box | null {
  if (at + 8 > bytes.length || offset + 8 > limit) return null;
  let size = readUint32BE(bytes, at);
  let headerLength = 8;
  if (size === 1) {
    if (at + 16 > bytes.length) return null;
    size =
      readUint32BE(bytes, at + 8) * 0x100000000 + readUint32BE(bytes, at + 12);
    headerLength = 16;
  } else if (size === 0) {
    size = limit - offset;
  }
  if (size < headerLength || offset + size > limit) return null;

  return {
    type: readChunkType(bytes, at + 4),
    start: offset,
    contentStart: offset + headerLength,
    end: offset + size,
  };
}

/** Content of a box, or `null` when it exceeds {@link MAX_BODY_READ}. */
async function readBody(
  source: ByteSource,
  box: Box,
): Promise<Uint8Array | null> {
  const length = box.end - box.contentStart;
  if (length > MAX_BODY_READ) return null;
  const body = await source.read(box.contentStart, length);
  return body.length === length ? body : null;
}

// ============================================================================
// Text helpers
// ============================================================================

function latin1(bytes: Uint8Array): string {
  return new TextDecoder('iso-8859-1').decode(bytes);
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
