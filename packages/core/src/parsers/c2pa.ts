/**
 * C2PA (Content Credentials) detection
 *
 * Commercial AI tools (OpenAI ChatGPT, Google Gemini, ...) embed a signed C2PA
 * manifest instead of A1111-style generation parameters. This module locates
 * the format-specific C2PA box and scans its plaintext bytes for the vendor and
 * IPTC DigitalSourceType markers.
 *
 * Scope is intentionally coarse: detection only. There is no JUMBF/CBOR parsing
 * and no signature verification. The relevant CBOR text strings (vendor names,
 * the DigitalSourceType URI, claim_generator_info.name) are stored uncompressed,
 * so a targeted byte scan is sufficient to identify the producing vendor.
 */

import type { C2paMetadata, C2paVendor } from '../types';
import { type ImageFormat, readChunkType, readUint32BE } from '../utils/binary';

const PNG_SIGNATURE_LENGTH = 8;

/** Maximum claim-generator length we will read (defensive cap on malformed input). */
const MAX_CLAIM_GENERATOR_LENGTH = 4096;

/**
 * Maximum caBX chunk bytes scanned. Real Content Credentials manifests are far
 * smaller, and every detection marker sits near the start of the uncompressed
 * box, so clamping bounds memory use against a maliciously oversized chunk.
 */
const MAX_CABX_SCAN_LENGTH = 8 * 1024 * 1024;

/** How far past `claim_generator_info` to look for its `name` value. */
const CLAIM_GENERATOR_SCAN_WINDOW = 256;

/**
 * IPTC DigitalSourceType concept-ids that mean "made by a trained AI model".
 *
 * Matched exactly (never by URI prefix) so camera/scan source types such as
 * `digitalCapture` are not mistaken for AI generation.
 */
const AI_DIGITAL_SOURCE_TYPES: ReadonlySet<string> = new Set([
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia',
  'compositeSynthetic',
]);

/**
 * Captures the full IPTC DigitalSourceType URI and its trailing concept-id.
 * Global: a manifest can carry several DigitalSourceType-shaped tokens (e.g. an
 * assertion label), so callers iterate and prefer an allowlisted concept-id.
 */
const DIGITAL_SOURCE_TYPE_RE =
  /https?:\/\/cv\.iptc\.org\/newscodes\/digitalsourcetype\/([A-Za-z]+)/g;

/**
 * Stable manifest substrings mapped to a coarse vendor.
 *
 * Kept as data so a new C2PA-signing vendor is a one-line addition. Order
 * matters only in that the first match wins; the markers are vendor-exclusive.
 */
const VENDOR_MARKERS: ReadonlyArray<{ marker: string; vendor: C2paVendor }> = [
  // OpenAI: claim_generator_info.name = "OpenAI Media Service API". Match the
  // full generator string, not a bare "OpenAI", so an unrelated occurrence in
  // another vendor's manifest can't collide (the signing CA is a third party).
  { marker: 'OpenAI Media Service API', vendor: 'openai' },
  // Google: signer "Google LLC" / "Google Media Processing Services",
  // generator "Google C2PA Core Generator Library".
  { marker: 'Google LLC', vendor: 'google' },
  { marker: 'Google C2PA', vendor: 'google' },
  { marker: 'Google Media Processing Services', vendor: 'google' },
];

/**
 * Detect C2PA Content Credentials in an image.
 *
 * @param data - Full image bytes
 * @param format - Detected image format
 * @returns C2paMetadata when a manifest is found, otherwise `null`
 */
export function detectC2pa(
  data: Uint8Array,
  format: ImageFormat,
): C2paMetadata | null {
  const manifest = extractManifest(data, format);
  if (!manifest) return null;

  // `text` is a 1:1 latin1 view of the manifest bytes, so character indices map
  // directly to byte indices (used by the claim-generator reader below).
  const text = latin1Decode(manifest);

  // Prefer a DigitalSourceType whose concept-id is in the AI allowlist; fall
  // back to the first occurrence so the raw value is still surfaced.
  const dstMatches = [...text.matchAll(DIGITAL_SOURCE_TYPE_RE)];
  const aiMatch = dstMatches.find((m) =>
    AI_DIGITAL_SOURCE_TYPES.has(m[1] ?? ''),
  );
  const digitalSourceType = (aiMatch ?? dstMatches[0])?.[0];
  const aiGenerated = aiMatch !== undefined;

  const vendor =
    VENDOR_MARKERS.find(({ marker }) => text.includes(marker))?.vendor ??
    'unknown';

  const claimGenerator = extractClaimGenerator(manifest, text);

  return {
    vendor,
    aiGenerated,
    ...(digitalSourceType ? { digitalSourceType } : {}),
    ...(claimGenerator ? { claimGenerator } : {}),
  };
}

/**
 * Extract the raw C2PA manifest bytes for the given format.
 *
 * Only PNG (`caBX` chunk) is supported today. JPEG (APP11/JUMBF) and WebP
 * (RIFF `C2PA` chunk) are deferred until real sample images are available.
 */
function extractManifest(
  data: Uint8Array,
  format: ImageFormat,
): Uint8Array | null {
  if (format === 'png') return extractPngCaBX(data);
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
      const scanLength = Math.min(length, MAX_CABX_SCAN_LENGTH);
      return data.slice(dataStart, dataStart + scanLength);
    }
    if (chunkType === 'IEND') return null;

    // Advance past data + 4-byte CRC.
    offset = dataStart + length + 4;
  }

  return null;
}

/**
 * Extract `claim_generator_info.name` from the manifest.
 *
 * Reads the single CBOR text string that follows the `name` key, without a full
 * CBOR decoder: locate the `claim_generator_info` marker, find the CBOR-encoded
 * `name` key after it, then read the length-prefixed text string value.
 */
function extractClaimGenerator(
  manifest: Uint8Array,
  text: string,
): string | undefined {
  const cgiIndex = text.indexOf('claim_generator_info');
  if (cgiIndex < 0) return undefined;

  // The CBOR map key "name" is encoded as 0x64 ('d') + the 4 ASCII bytes, i.e.
  // the byte sequence "dname". Search only a small window after the marker so a
  // stray "...name" (e.g. "filename") elsewhere cannot be misread as the key.
  const windowEnd = Math.min(
    text.length,
    cgiIndex + CLAIM_GENERATOR_SCAN_WINDOW,
  );
  for (
    let p = text.indexOf('dname', cgiIndex);
    p >= 0 && p < windowEnd;
    p = text.indexOf('dname', p + 1)
  ) {
    const value = readCborTextString(manifest, p + 5);
    if (value) return value;
  }

  return undefined;
}

/**
 * Read a single CBOR text string (major type 3) at `pos`.
 *
 * Handles inline (0-23), 1-byte, and 2-byte length encodings — enough for any
 * realistic generator name. Returns `null` for anything else.
 */
function readCborTextString(bytes: Uint8Array, pos: number): string | null {
  const initial = bytes[pos];
  if (initial === undefined || initial < 0x60 || initial > 0x7b) return null;

  const header = readCborLength(bytes, pos, initial & 0x1f);
  if (!header) return null;

  const { length, dataPos } = header;
  if (length < 0 || length > MAX_CLAIM_GENERATOR_LENGTH) return null;
  if (dataPos + length > bytes.length) return null;

  return new TextDecoder('utf-8').decode(
    bytes.slice(dataPos, dataPos + length),
  );
}

/**
 * Resolve a CBOR major-type-3 length header into `{ length, dataPos }`.
 *
 * Handles inline (0-23), 1-byte (24), and 2-byte (25) length encodings; returns
 * `null` for 4/8-byte or indefinite lengths (not used by real generator names).
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

/**
 * Decode bytes as Latin-1 (ISO-8859-1): a lossless 1:1 byte-to-char mapping.
 */
function latin1Decode(data: Uint8Array): string {
  return new TextDecoder('iso-8859-1').decode(data);
}
