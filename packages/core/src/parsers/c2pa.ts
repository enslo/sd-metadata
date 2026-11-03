/**
 * C2PA (Content Credentials) vendor detection
 *
 * Commercial AI services (ChatGPT, Gemini, Grok, ...) embed a signed C2PA
 * manifest store instead of A1111-style generation parameters. This module
 * locates the format-specific store, splits it into manifests along its JUMBF
 * box structure, and scans the plaintext bytes of the relevant manifest for
 * vendor markers, the IPTC DigitalSourceType and the declared software agent.
 *
 * Scope is intentionally coarse: detection only. There is no CBOR decoder and
 * no signature verification. The relevant CBOR text strings (vendor names, the
 * DigitalSourceType URI, claim generator and software agent names) are stored
 * uncompressed, so a targeted byte scan is sufficient.
 */

import type { Vendor, VendorInfo } from '../types';
import { type ImageFormat, readChunkType, readUint32BE } from '../utils/binary';

const PNG_SIGNATURE_LENGTH = 8;

/** Maximum CBOR text string length we will read (defensive cap on malformed input). */
const MAX_CBOR_TEXT_LENGTH = 4096;

/**
 * Maximum manifest store bytes scanned. Real Content Credentials manifests are
 * far smaller, so clamping bounds memory use against a maliciously oversized
 * chunk or segment run.
 */
const MAX_STORE_SCAN_LENGTH = 8 * 1024 * 1024;

/** How far past `softwareAgent` to look for the `name` key of a map value. */
const SOFTWARE_AGENT_SCAN_WINDOW = 64;

/** JPEG APP11 marker byte, which carries JUMBF boxes (ISO/IEC 19566-5). */
const APP11_MARKER = 0xeb;

/** JPEG start-of-scan marker byte: no metadata segments follow it. */
const SOS_MARKER = 0xda;

/**
 * Bytes between the APP11 length field and the box data: the "JP" common
 * identifier (2), box instance number (2) and packet sequence number (4).
 */
const APP11_JP_HEADER_LENGTH = 8;

/**
 * IPTC DigitalSourceType concept-ids that mean "made by a trained AI model".
 *
 * Matched exactly (never by URI prefix) so camera/scan source types such as
 * `digitalCapture` or `composite` are not mistaken for AI generation.
 */
const AI_DIGITAL_SOURCE_TYPES: ReadonlySet<string> = new Set([
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia',
  'compositeSynthetic',
]);

/**
 * Matches a full IPTC DigitalSourceType URI, concept-id included. In CBOR the
 * match can overrun into the next key; see {@link boundToCborString}.
 * Global: a manifest can carry several DigitalSourceType-shaped tokens (e.g. an
 * assertion label), so callers iterate and look for an allowlisted concept-id.
 */
const DIGITAL_SOURCE_TYPE_RE =
  /https?:\/\/cv\.iptc\.org\/newscodes\/digitalsourcetype\/[A-Za-z]+/g;

/** Anchored form of {@link DIGITAL_SOURCE_TYPE_RE} for validating one URI. */
const WHOLE_DIGITAL_SOURCE_TYPE_RE = new RegExp(
  `^${DIGITAL_SOURCE_TYPE_RE.source}$`,
);

/**
 * Stable manifest substrings mapped to a coarse vendor.
 *
 * Matched against the claim and signature of the creating manifest only (see
 * {@link detectC2paVendor}), so a vendor named in an ingredient's assertions
 * cannot leak in. Kept as data so a new C2PA-signing vendor is a one-line
 * addition; the first match wins and the markers are vendor-exclusive.
 */
const VENDOR_MARKERS: ReadonlyArray<{ marker: string; vendor: Vendor }> = [
  // OpenAI: claim_generator_info.name = "OpenAI Media Service API". Match the
  // full generator string, not a bare "OpenAI", so an unrelated occurrence
  // can't collide (the signing CA is a third party).
  { marker: 'OpenAI Media Service API', vendor: 'openai' },
  // Google: signer "Google LLC" / "Google Media Processing Services",
  // generator "Google C2PA Core Generator Library".
  { marker: 'Google LLC', vendor: 'google' },
  { marker: 'Google C2PA', vendor: 'google' },
  { marker: 'Google Media Processing Services', vendor: 'google' },
  // xAI: signer "xAI Grok Imagine", generator "Grok Imagine".
  { marker: 'xAI Grok Imagine', vendor: 'xai' },
  { marker: 'Grok Imagine', vendor: 'xai' },
];

/** One manifest of a store, as byte ranges of the store. */
interface Manifest {
  /** Claim, signature and any other non-assertion boxes, concatenated. */
  identity: Uint8Array;
  /** Content of the `c2pa.actions` assertion, empty when there is none. */
  actions: Uint8Array;
}

/**
 * Detect a vendor declaration in an image's C2PA Content Credentials.
 *
 * A store can hold several manifests: an edit appends one that references
 * the previous ones as ingredients. The vendor and product are read from the
 * creating manifest, the newest one whose actions include `c2pa.created`
 * (or the active, last one when none does). The AI declaration may sit in
 * any manifest: an edit's own DigitalSourceType can be a non-AI value such as
 * `composite` while the ingredient it edits declares the AI generation.
 *
 * @param data - Full image bytes
 * @param format - Detected image format
 * @returns The declaration when the store declares AI generation or names a
 *   known vendor, otherwise `null`
 */
export function detectC2paVendor(
  data: Uint8Array,
  format: ImageFormat,
): VendorInfo | null {
  const store = extractStore(data, format);
  if (!store) return null;

  const creator = findCreator(splitManifests(store));
  if (!creator) return null;

  const identity = latin1Decode(creator.identity);
  const vendor =
    VENDOR_MARKERS.find(({ marker }) => identity.includes(marker))?.vendor ??
    'unknown';

  if (vendor === 'unknown' && !declaresAiDigitalSourceType(store)) return null;

  const product = readCreatedSoftwareAgent(creator.actions);
  return { vendor, ...(product ? { product } : {}), source: 'c2pa' };
}

/**
 * Whether the bytes declare an AI-generated IPTC DigitalSourceType.
 *
 * Accepts CBOR manifest bytes (the URI is bounded by its CBOR length header)
 * and XMP text (the URI ends at a quote or `<`).
 *
 * @param bytes - Manifest bytes, or XMP text
 */
export function declaresAiDigitalSourceType(
  bytes: Uint8Array | string,
): boolean {
  const text = typeof bytes === 'string' ? bytes : latin1Decode(bytes);
  for (const match of text.matchAll(DIGITAL_SOURCE_TYPE_RE)) {
    const uri =
      typeof bytes === 'string'
        ? match[0]
        : boundToCborString(bytes, match.index, match[0]);
    if (AI_DIGITAL_SOURCE_TYPES.has(uri.slice(uri.lastIndexOf('/') + 1))) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Store extraction
// ============================================================================

/**
 * Extract the raw C2PA manifest store bytes for the given format.
 *
 * PNG (`caBX` chunk) and JPEG (APP11 JUMBF segments) are supported. WebP
 * (RIFF `C2PA` chunk) is deferred until real sample images are available.
 */
function extractStore(
  data: Uint8Array,
  format: ImageFormat,
): Uint8Array | null {
  if (format === 'png') return extractPngCaBX(data);
  if (format === 'jpeg') return extractJpegJumbf(data);
  return null;
}

/**
 * Find the PNG `caBX` ancillary chunk that holds the C2PA manifest store.
 */
function extractPngCaBX(data: Uint8Array): Uint8Array | null {
  let offset = PNG_SIGNATURE_LENGTH;

  while (offset + 8 <= data.length) {
    const length = readUint32BE(data, offset);
    const chunkType = readChunkType(data, offset + 4);
    const dataStart = offset + 8;

    if (dataStart + length > data.length) return null;

    if (chunkType === 'caBX') {
      const scanLength = Math.min(length, MAX_STORE_SCAN_LENGTH);
      return data.slice(dataStart, dataStart + scanLength);
    }
    if (chunkType === 'IEND') return null;

    // Advance past data + 4-byte CRC.
    offset = dataStart + length + 4;
  }

  return null;
}

/**
 * Reassemble the C2PA manifest store from JPEG APP11 segments.
 *
 * A JUMBF box larger than one segment (64 KB) is split across APP11
 * segments that share a box instance number and carry increasing packet
 * sequence numbers. Every continuation repeats the box header, which is
 * dropped when the payloads are joined. The box instance whose superbox is
 * labelled `c2pa` is the manifest store.
 */
function extractJpegJumbf(data: Uint8Array): Uint8Array | null {
  const instances = new Map<
    number,
    { sequence: number; payload: Uint8Array }[]
  >();
  let offset = 2; // Skip SOI

  while (offset + 4 <= data.length && data[offset] === 0xff) {
    const marker = data[offset + 1];
    if (marker === SOS_MARKER) break;

    const segmentLength =
      ((data[offset + 2] ?? 0) << 8) | (data[offset + 3] ?? 0);
    const payloadStart = offset + 4 + APP11_JP_HEADER_LENGTH;
    const segmentEnd = offset + 2 + segmentLength;
    if (segmentEnd > data.length) break;

    if (
      marker === APP11_MARKER &&
      payloadStart <= segmentEnd &&
      data[offset + 4] === 0x4a && // 'J'
      data[offset + 5] === 0x50 // 'P'
    ) {
      const instance = ((data[offset + 6] ?? 0) << 8) | (data[offset + 7] ?? 0);
      const sequence = readUint32BE(data, offset + 8);
      const packets = instances.get(instance) ?? [];
      packets.push({
        sequence,
        payload: data.subarray(payloadStart, segmentEnd),
      });
      instances.set(instance, packets);
    }

    offset = segmentEnd;
  }

  for (const packets of instances.values()) {
    packets.sort((a, b) => a.sequence - b.sequence);
    const [first, ...rest] = packets;
    if (!first) continue;
    const headerLength = boxHeaderLength(first.payload);
    if (headerLength === null) continue;

    const parts = [
      first.payload,
      ...rest.map((p) => p.payload.subarray(headerLength)),
    ];
    const store = concat(parts, MAX_STORE_SCAN_LENGTH);
    if (superboxLabel(store, 0, store.length) === 'c2pa') return store;
  }

  return null;
}

// ============================================================================
// JUMBF boxes
// ============================================================================

/** A box inside a byte range: its type and the range of its content. */
interface Box {
  type: string;
  start: number;
  contentStart: number;
  end: number;
}

/**
 * Header length (8, or 16 with an extended length) of the box at offset 0,
 * or `null` when the bytes cannot start a box.
 */
function boxHeaderLength(bytes: Uint8Array): number | null {
  if (bytes.length < 8) return null;
  const length = readUint32BE(bytes, 0);
  if (length === 1) return bytes.length >= 16 ? 16 : null;
  return 8;
}

/**
 * The boxes directly inside `[start, end)`. Stops at the first malformed box.
 */
function readBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;

  while (offset + 8 <= end) {
    let length = readUint32BE(bytes, offset);
    let headerLength = 8;
    if (length === 1) {
      if (offset + 16 > end) break;
      // Extended 64-bit length; a store never exceeds 2^32 bytes here, so the
      // high word must be zero.
      if (readUint32BE(bytes, offset + 8) !== 0) break;
      length = readUint32BE(bytes, offset + 12);
      headerLength = 16;
    } else if (length === 0) {
      length = end - offset;
    }
    if (length < headerLength || offset + length > end) break;

    boxes.push({
      type: readChunkType(bytes, offset + 4),
      start: offset,
      contentStart: offset + headerLength,
      end: offset + length,
    });
    offset += length;
  }

  return boxes;
}

/**
 * Label of the JUMBF superbox (`jumb`) whose content is `[start, end)`, read
 * from its leading description box (`jumd`): a 16-byte content type UUID, a
 * toggles byte, then the null-terminated label when toggle bit 1 is set.
 */
function superboxLabel(
  bytes: Uint8Array,
  start: number,
  end: number,
): string | undefined {
  const [outer] = readBoxes(bytes, start, end);
  if (outer?.type !== 'jumb') return undefined;
  return descriptionLabel(bytes, outer);
}

/** Label of a `jumb` box, from its first child `jumd`. */
function descriptionLabel(bytes: Uint8Array, jumb: Box): string | undefined {
  const [description] = readBoxes(bytes, jumb.contentStart, jumb.end);
  if (description?.type !== 'jumd') return undefined;

  const toggles = bytes[description.contentStart + 16];
  if (toggles === undefined || (toggles & 0x02) === 0) return undefined;

  const labelStart = description.contentStart + 17;
  const nul = bytes.indexOf(0, labelStart);
  const labelEnd = nul < 0 || nul > description.end ? description.end : nul;
  return latin1Decode(bytes.subarray(labelStart, labelEnd));
}

/** The `jumb` children of a `jumb` box, with their labels. */
function childSuperboxes(
  bytes: Uint8Array,
  jumb: Box,
): { box: Box; label: string | undefined }[] {
  return readBoxes(bytes, jumb.contentStart, jumb.end)
    .filter((box) => box.type === 'jumb')
    .map((box) => ({ box, label: descriptionLabel(bytes, box) }));
}

/**
 * Split a manifest store into its manifests, oldest first.
 *
 * Store layout: a `jumb` labelled `c2pa` holding one `jumb` per manifest;
 * each manifest holds a `c2pa.assertions` `jumb` (one `jumb` per assertion)
 * next to its claim and signature. When the boxes cannot be walked, the whole
 * store is returned as a single manifest so detection degrades to a flat scan
 * instead of failing.
 */
function splitManifests(store: Uint8Array): Manifest[] {
  const [root] = readBoxes(store, 0, store.length);
  const manifests =
    root?.type === 'jumb'
      ? childSuperboxes(store, root).map(({ box }) => readManifest(store, box))
      : [];
  return manifests.length > 0
    ? manifests
    : [{ identity: store, actions: store }];
}

/**
 * The newest manifest whose actions include `c2pa.created`, or the active
 * (last) manifest when none does.
 */
function findCreator(manifests: Manifest[]): Manifest | undefined {
  for (let i = manifests.length - 1; i >= 0; i--) {
    const manifest = manifests[i];
    if (manifest && latin1Decode(manifest.actions).includes('c2pa.created')) {
      return manifest;
    }
  }
  return manifests.at(-1);
}

/** Separate one manifest's assertions from its identity (claim, signature). */
function readManifest(store: Uint8Array, manifest: Box): Manifest {
  const identityParts: Uint8Array[] = [];
  let actions: Uint8Array = new Uint8Array(0);

  for (const { box, label } of childSuperboxes(store, manifest)) {
    if (label !== 'c2pa.assertions') {
      identityParts.push(store.subarray(box.start, box.end));
      continue;
    }
    const assertion = childSuperboxes(store, box).find(({ label: l }) =>
      l?.startsWith('c2pa.actions'),
    );
    if (assertion) {
      actions = store.subarray(assertion.box.contentStart, assertion.box.end);
    }
  }

  return { identity: concat(identityParts, MAX_STORE_SCAN_LENGTH), actions };
}

// ============================================================================
// CBOR text scanning
// ============================================================================

/**
 * Name of the software agent of the `c2pa.created` action, if declared.
 *
 * The value is either a text string (`"Grok Imagine"`) or a map whose `name`
 * key holds it (`{ name: "ChatGPT", version: "gpt-image" }`). Only the span
 * of the created action is searched, up to the next `action` key.
 */
function readCreatedSoftwareAgent(actions: Uint8Array): string | undefined {
  const text = latin1Decode(actions);
  const created = text.indexOf('c2pa.created');
  if (created < 0) return undefined;

  // CBOR key "action" is 0x66 ('f') followed by the 6 ASCII bytes.
  const nextAction = text.indexOf('faction', created);
  const spanEnd = nextAction < 0 ? text.length : nextAction;
  const key = text.indexOf('softwareAgent', created);
  if (key < 0 || key >= spanEnd) return undefined;

  const valuePos = key + 'softwareAgent'.length;
  const initial = actions[valuePos];
  if (initial === undefined) return undefined;

  // Major type 5 (map): find the CBOR key "name" (0x64 'd' + "name").
  if (initial >= 0xa0 && initial <= 0xbf) {
    const windowEnd = Math.min(spanEnd, valuePos + SOFTWARE_AGENT_SCAN_WINDOW);
    const name = text.indexOf('dname', valuePos);
    if (name < 0 || name >= windowEnd) return undefined;
    return readCborTextString(actions, name + 5) ?? undefined;
  }
  return readCborTextString(actions, valuePos) ?? undefined;
}

/**
 * Trim a DigitalSourceType match to the CBOR text string that holds it.
 *
 * In CBOR the next map key follows a value with no delimiter, and a short
 * key's header byte (0x61-0x77) reads as an ASCII letter, so the letter-only
 * regex can run into the next key (e.g. "...MediarallActionsIncluded"). When
 * the URI is preceded by a 1- or 2-byte CBOR length header that fits within
 * the match, that length is authoritative. Otherwise (e.g. XMP text) the
 * match already ends at a non-letter delimiter and is returned as-is.
 */
function boundToCborString(
  manifest: Uint8Array,
  index: number,
  match: string,
): string {
  let length: number | undefined;
  if (manifest[index - 2] === 0x78) {
    length = manifest[index - 1];
  } else if (manifest[index - 3] === 0x79) {
    length = ((manifest[index - 2] ?? 0) << 8) | (manifest[index - 1] ?? 0);
  }
  if (length === undefined || length > match.length) return match;

  // A header that would cut into the URI itself is not the URI's own header.
  const bounded = match.slice(0, length);
  return WHOLE_DIGITAL_SOURCE_TYPE_RE.test(bounded) ? bounded : match;
}

/**
 * Read a single CBOR text string (major type 3) at `pos`.
 *
 * Handles inline (0-23), 1-byte, and 2-byte length encodings — enough for any
 * realistic name. Returns `null` for anything else.
 */
function readCborTextString(bytes: Uint8Array, pos: number): string | null {
  const initial = bytes[pos];
  if (initial === undefined || initial < 0x60 || initial > 0x7b) return null;

  const header = readCborLength(bytes, pos, initial & 0x1f);
  if (!header) return null;

  const { length, dataPos } = header;
  if (length < 0 || length > MAX_CBOR_TEXT_LENGTH) return null;
  if (dataPos + length > bytes.length) return null;

  return new TextDecoder('utf-8').decode(
    bytes.slice(dataPos, dataPos + length),
  );
}

/**
 * Resolve a CBOR major-type-3 length header into `{ length, dataPos }`.
 *
 * Handles inline (0-23), 1-byte (24), and 2-byte (25) length encodings; returns
 * `null` for 4/8-byte or indefinite lengths (not used by real names).
 */
function readCborLength(
  bytes: Uint8Array,
  pos: number,
  additional: number,
): { length: number; dataPos: number } | null {
  if (additional < 24) return { length: additional, dataPos: pos + 1 };
  if (additional === 24) {
    return { length: bytes[pos + 1] ?? -1, dataPos: pos + 2 };
  }
  if (additional === 25) {
    return {
      length: ((bytes[pos + 1] ?? 0) << 8) | (bytes[pos + 2] ?? 0),
      dataPos: pos + 3,
    };
  }
  return null;
}

// ============================================================================
// Byte helpers
// ============================================================================

/** Join byte ranges, stopping at `limit` bytes. */
function concat(parts: Uint8Array[], limit: number): Uint8Array {
  const total = Math.min(
    limit,
    parts.reduce((sum, p) => sum + p.length, 0),
  );
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    if (offset >= total) break;
    const take = part.subarray(0, total - offset);
    out.set(take, offset);
    offset += take.length;
  }
  return out;
}

/**
 * Decode bytes as Latin-1 (ISO-8859-1): a lossless 1:1 byte-to-char mapping,
 * so string indices are byte indices.
 */
function latin1Decode(data: Uint8Array): string {
  return new TextDecoder('iso-8859-1').decode(data);
}
