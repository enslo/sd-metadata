/**
 * Vendor detection
 *
 * Commercial AI services declare their images in one of three places. They
 * are checked in this order, and the first declaration found wins:
 *
 * 1. C2PA Content Credentials: the only source that can also name the
 *    service, so it is preferred when an image carries several.
 * 2. XMP: an IPTC DigitalSourceType declaring AI generation, with the vendor
 *    in `dc:publisher` (Meta's Muse).
 * 3. xAI's `Signature: <base64>` in EXIF ImageDescription (Grok).
 */

import type { MetadataSegment, RawMetadata } from '../types';
import type { ImageFormat } from '../utils/binary';
import { declaresAiDigitalSourceType, detectC2paVendor } from './c2pa';
import type { VendorDeclaration } from './types';

/**
 * Minimum decoded length of an xAI signature. Observed signatures are 128,
 * 192 and 256 bytes; anything shorter is not treated as one.
 */
const MIN_SIGNATURE_BYTES = 128;

/** A whole value of standard base64 characters with optional padding. */
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** First publisher in an XMP `dc:publisher` container. */
const XMP_PUBLISHER_RE =
  /<dc:publisher>\s*<rdf:(?:Bag|Seq)>\s*<rdf:li>([^<]*)<\/rdf:li>/;

/**
 * Detect a vendor declaration in an image without generation metadata.
 *
 * @param data - Full image bytes
 * @param format - Detected image format
 * @param raw - Raw metadata read from the image, if any
 * @returns The declaration, or `null` when the image carries none
 */
export function detectVendor(
  data: Uint8Array,
  format: ImageFormat,
  raw: RawMetadata | undefined,
): VendorDeclaration | null {
  const c2pa = detectC2paVendor(data, format);
  if (c2pa) return c2pa;

  if (!raw || raw.format === 'png') return null;
  return detectXmpVendor(raw.segments) ?? detectSignatureVendor(raw.segments);
}

/**
 * Read a vendor declaration from an XMP packet: an AI-generated
 * DigitalSourceType, with the vendor in `dc:publisher`.
 *
 * @param xmp - XMP packet text
 * @returns The declaration, or `null` without an AI DigitalSourceType
 */
export function readXmpDeclaration(xmp: string): VendorDeclaration | null {
  if (!declaresAiDigitalSourceType(xmp)) return null;
  const publisher = xmp.match(XMP_PUBLISHER_RE)?.[1]?.trim();
  return { vendor: publisher === 'Meta' ? 'meta' : 'unknown', source: 'xmp' };
}

/**
 * Whether a value is the base64 payload of an xAI signature: the text after
 * `Signature: `, at least {@link MIN_SIGNATURE_BYTES} bytes once decoded.
 *
 * @param payload - Value with the `Signature: ` label removed
 */
export function isXaiSignature(payload: string): boolean {
  return (
    BASE64_RE.test(payload) &&
    base64DecodedLength(payload) >= MIN_SIGNATURE_BYTES
  );
}

function detectXmpVendor(
  segments: MetadataSegment[],
): VendorDeclaration | null {
  for (const { source, data } of segments) {
    if (source.type !== 'xmpPacket') continue;
    const declaration = readXmpDeclaration(data);
    if (declaration) return declaration;
  }
  return null;
}

/**
 * xAI's signature in an EXIF ImageDescription whose whole value is
 * `Signature: <base64>`.
 */
function detectSignatureVendor(
  segments: MetadataSegment[],
): VendorDeclaration | null {
  const signed = segments.some(
    ({ source, data }) =>
      source.type === 'exifImageDescription' &&
      source.prefix === 'Signature' &&
      isXaiSignature(data),
  );
  return signed ? { vendor: 'xai', source: 'signature' } : null;
}

/** Byte length of the data a base64 string decodes to. */
function base64DecodedLength(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}
