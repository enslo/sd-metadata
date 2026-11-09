/**
 * WebM / MKV (Matroska) metadata reader
 *
 * Walks the children of the Segment by their headers alone and reads only
 * the elements that hold metadata: Tracks (video size) and Tags. The walk
 * stops at the first Cluster (media data); Tags or Tracks written after
 * the clusters are then located through the SeekHead.
 *
 * Only tags that target the whole file are kept: per-track tags (ffmpeg's
 * ENCODER / DURATION) describe a stream, not the generation.
 */

import type { VideoTag } from '../types';
import { trimTrailingNul } from '../utils/text';
import type { ByteSource } from './byte-source';
import { MAX_BODY_READ, type VideoContainer } from './video-container';

// Element IDs, with their length marker bits as written in the file.
const EBML = 0x1a45dfa3;
const DOC_TYPE = 0x4282;
const SEGMENT = 0x18538067;
const SEEK_HEAD = 0x114d9b74;
const SEEK = 0x4dbb;
const SEEK_ID = 0x53ab;
const SEEK_POSITION = 0x53ac;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const TRACK_TYPE = 0x83;
const VIDEO = 0xe0;
const PIXEL_WIDTH = 0xb0;
const PIXEL_HEIGHT = 0xba;
const TAGS = 0x1254c367;
const TAG = 0x7373;
const TARGETS = 0x63c0;
const SIMPLE_TAG = 0x67c8;
const TAG_NAME = 0x45a3;
const TAG_STRING = 0x4487;
const CLUSTER = 0x1f43b675;

/** Target UIDs that narrow a Tag to a track, edition, chapter or attachment. */
const TARGET_UIDS: ReadonlySet<number> = new Set([
  0x63c5, // TagTrackUID
  0x63c9, // TagEditionUID
  0x63c4, // TagChapterUID
  0x63c6, // TagAttachmentUID
]);

/** TrackType value of a video track. */
const TRACK_TYPE_VIDEO = 1;

/** Largest element header: a 4-byte ID and an 8-byte size. */
const MAX_HEADER_LENGTH = 12;

/** An element located in the file or in a byte array. */
interface Element {
  id: number;
  start: number;
  dataStart: number;
  /** End of the data; the parent's end when the size is unknown */
  end: number;
  unknownSize: boolean;
}

/**
 * Read a Matroska file, or return `null` when it is not one (no EBML
 * header, or a DocType other than `webm` / `matroska`).
 */
export async function readMatroska(
  source: ByteSource,
): Promise<VideoContainer | null> {
  const header = await readElementAt(source, 0, source.size);
  if (header?.id !== EBML) return null;
  const headerBody = await readBody(source, header);
  if (!headerBody) return null;

  const docType = readString(headerBody, DOC_TYPE);
  const format =
    docType === 'webm' ? 'webm' : docType === 'matroska' ? 'mkv' : null;
  if (!format) return null;

  const container: VideoContainer = { format, tags: [], width: 0, height: 0 };
  const segment = await readElementAt(source, header.end, source.size);
  if (segment?.id !== SEGMENT) return container;

  const seen = new Set<number>();
  const seekPositions = new Map<number, number>();
  const readTopLevel = async (element: Element): Promise<void> => {
    if (element.id !== TRACKS && element.id !== TAGS) return;
    if (seen.has(element.id)) return;
    seen.add(element.id);
    const body = await readBody(source, element);
    if (!body) return;
    if (element.id === TRACKS) readTrackSize(body, container);
    else container.tags.push(...readTags(body));
  };

  for (
    let element = await readElementAt(source, segment.dataStart, segment.end);
    element;
    element = element.unknownSize
      ? null
      : await readElementAt(source, element.end, segment.end)
  ) {
    if (element.id === CLUSTER) break;
    if (element.id === SEEK_HEAD) {
      const body = await readBody(source, element);
      if (body) readSeekHead(body, seekPositions);
    }
    await readTopLevel(element);
  }

  // Tags or Tracks after the clusters: follow the SeekHead.
  for (const id of [TRACKS, TAGS]) {
    const position = seekPositions.get(id);
    if (seen.has(id) || position === undefined) continue;
    const element = await readElementAt(
      source,
      segment.dataStart + position,
      segment.end,
    );
    if (element?.id === id) await readTopLevel(element);
  }

  return container;
}

// ============================================================================
// Element bodies
// ============================================================================

/** SeekHead entries: element ID → position relative to the Segment data. */
function readSeekHead(body: Uint8Array, positions: Map<number, number>): void {
  for (const seek of elementsIn(body, 0, body.length)) {
    if (seek.id !== SEEK) continue;
    let id: number | undefined;
    let position: number | undefined;
    for (const child of elementsIn(body, seek.dataStart, seek.end)) {
      if (child.id === SEEK_ID) id = readUint(body, child);
      if (child.id === SEEK_POSITION) position = readUint(body, child);
    }
    if (id !== undefined && position !== undefined && !positions.has(id)) {
      positions.set(id, position);
    }
  }
}

/** Pixel size of the first video track. */
function readTrackSize(body: Uint8Array, container: VideoContainer): void {
  for (const entry of elementsIn(body, 0, body.length)) {
    if (entry.id !== TRACK_ENTRY) continue;
    let isVideo = false;
    let width = 0;
    let height = 0;
    for (const child of elementsIn(body, entry.dataStart, entry.end)) {
      if (child.id === TRACK_TYPE) {
        isVideo = readUint(body, child) === TRACK_TYPE_VIDEO;
      }
      if (child.id !== VIDEO) continue;
      for (const field of elementsIn(body, child.dataStart, child.end)) {
        if (field.id === PIXEL_WIDTH) width = readUint(body, field);
        if (field.id === PIXEL_HEIGHT) height = readUint(body, field);
      }
    }
    if (isVideo && width > 0 && height > 0) {
      container.width = width;
      container.height = height;
      return;
    }
  }
}

/** SimpleTags of every Tag whose Targets name no UID (the whole file). */
function readTags(body: Uint8Array): VideoTag[] {
  const tags: VideoTag[] = [];
  for (const tag of elementsIn(body, 0, body.length)) {
    if (tag.id !== TAG) continue;
    const children = [...elementsIn(body, tag.dataStart, tag.end)];
    const targets = children.find((c) => c.id === TARGETS);
    const narrowed =
      targets !== undefined &&
      [...elementsIn(body, targets.dataStart, targets.end)].some((c) =>
        TARGET_UIDS.has(c.id),
      );
    if (narrowed) continue;

    for (const simpleTag of children) {
      if (simpleTag.id !== SIMPLE_TAG) continue;
      let key: string | undefined;
      let value: string | undefined;
      for (const field of elementsIn(
        body,
        simpleTag.dataStart,
        simpleTag.end,
      )) {
        if (field.id === TAG_NAME) key = readUtf8(body, field);
        if (field.id === TAG_STRING) value = readUtf8(body, field);
      }
      if (key !== undefined && value !== undefined) {
        tags.push({ key, value, source: 'matroska' });
      }
    }
  }
  return tags;
}

/** String value of the first child with the given ID. */
function readString(body: Uint8Array, id: number): string | undefined {
  for (const element of elementsIn(body, 0, body.length)) {
    if (element.id === id) return trimTrailingNul(readUtf8(body, element));
  }
  return undefined;
}

// ============================================================================
// EBML
// ============================================================================

/**
 * Header of the element at `offset`, or `null` past `limit` or when
 * malformed. An unknown size runs to `limit`.
 */
async function readElementAt(
  source: ByteSource,
  offset: number,
  limit: number,
): Promise<Element | null> {
  if (offset >= limit) return null;
  const header = await source.read(offset, MAX_HEADER_LENGTH);
  return parseElementHeader(header, 0, offset, limit);
}

/** The elements directly inside `[start, end)` of a byte array. */
function* elementsIn(
  bytes: Uint8Array,
  start: number,
  end: number,
): Generator<Element> {
  for (
    let element = parseElementHeader(bytes, start, start, end);
    element && !element.unknownSize;
    element = parseElementHeader(bytes, element.end, element.end, end)
  ) {
    yield element;
  }
}

/**
 * Parse an element header found at `bytes[at]`, describing an element that
 * starts at `offset` (in the same coordinates as `limit`).
 */
function parseElementHeader(
  bytes: Uint8Array,
  at: number,
  offset: number,
  limit: number,
): Element | null {
  const id = readVint(bytes, at, 4, true);
  if (!id) return null;
  const size = readVint(bytes, at + id.length, 8, false);
  if (!size) return null;

  const dataStart = offset + id.length + size.length;
  const end = size.unknown ? limit : dataStart + size.value;
  if (dataStart > limit || end > limit) return null;
  return {
    id: id.value,
    start: offset,
    dataStart,
    end,
    unknownSize: size.unknown,
  };
}

/**
 * Read an EBML variable-length integer: the number of leading zero bits of
 * the first byte gives the length. IDs keep the length marker; sizes drop
 * it, and a size with all value bits set means "unknown".
 */
function readVint(
  bytes: Uint8Array,
  at: number,
  maxLength: number,
  keepMarker: boolean,
): { value: number; length: number; unknown: boolean } | null {
  const first = bytes[at];
  if (first === undefined || first === 0) return null;

  let length = 1;
  let marker = 0x80;
  while ((first & marker) === 0) {
    length++;
    marker >>= 1;
  }
  if (length > maxLength || at + length > bytes.length) return null;

  let value = keepMarker ? first : first & (marker - 1);
  let allOnes = (first & (marker - 1)) === marker - 1;
  for (let i = 1; i < length; i++) {
    const byte = bytes[at + i] ?? 0;
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

/**
 * Unsigned integer element value (up to 8 bytes, big-endian)
 *
 * A wider element is not an integer the format allows; reading it would
 * multiply up to Infinity, so it reads as 0, which no caller accepts.
 */
function readUint(bytes: Uint8Array, element: Element): number {
  if (element.end - element.dataStart > 8) return 0;
  let value = 0;
  for (let i = element.dataStart; i < element.end; i++) {
    value = value * 256 + (bytes[i] ?? 0);
  }
  return value;
}

function readUtf8(bytes: Uint8Array, element: Element): string {
  return new TextDecoder('utf-8').decode(
    bytes.subarray(element.dataStart, element.end),
  );
}

/** Data of an element, or `null` when it exceeds {@link MAX_BODY_READ}. */
async function readBody(
  source: ByteSource,
  element: Element,
): Promise<Uint8Array | null> {
  const length = element.end - element.dataStart;
  if (element.unknownSize || length > MAX_BODY_READ) return null;
  const body = await source.read(element.dataStart, length);
  return body.length === length ? body : null;
}
