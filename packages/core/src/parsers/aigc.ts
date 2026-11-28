/**
 * AIGC label detection
 *
 * China's GB 45438-2025 has AI services write an "implicit label" into the
 * metadata of what they generate: a JSON object with the fields `Label`,
 * `ContentProducer`, `ProduceID`, `ReservedCode1`, `ContentPropagator`,
 * `PropagateID` and `ReservedCode2`. Services store it in different places;
 * the two read here are the ones seen in real files:
 *
 * - a PNG text chunk named `AIGC` holding the object (Kling)
 * - an EXIF UserComment holding `{"AIGC": {...}}` (Tencent Yuanbao, which
 *   puts the EXIF of a PNG in an eXIf chunk)
 *
 * The label names the provider, by a name or by a registered code, and no
 * service. It is read as written: its reserved fields may carry a signature,
 * which is not verified.
 */

import type {
  MetadataSegment,
  PngTextChunk,
  RawMetadata,
  Vendor,
} from '../types';
import { parseJson } from '../utils/json';
import type { VendorDeclaration } from './types';

/** Keyword of the PNG text chunk, and key of the UserComment wrapper. */
const AIGC_KEY = 'AIGC';

/**
 * Unified social credit code of Shenzhen Tencent Computer Systems. Tencent's
 * provider code holds it between a prefix and a suffix
 * (`001191440300708461136T1WFUO`).
 */
const TENCENT_CREDIT_CODE = '91440300708461136T';

/** The provider name Kling writes instead of a code. */
const KLING_PRODUCER = 'kling';

/**
 * Detect a vendor declaration made with an AIGC label.
 *
 * @param raw - Raw metadata read from the image
 * @returns The declaration, or `null` when the metadata holds no label
 */
export function detectAigcVendor(raw: RawMetadata): VendorDeclaration | null {
  const producer =
    raw.format === 'png'
      ? (producerInChunks(raw.chunks) ?? producerInSegments(raw.exif ?? []))
      : producerInSegments(raw.segments);
  if (producer === undefined) return null;

  return { vendor: vendorOf(producer), source: 'aigc' };
}

/** The provider of a label in a PNG text chunk named `AIGC`. */
function producerInChunks(chunks: PngTextChunk[]): string | undefined {
  for (const { keyword, text } of chunks) {
    if (keyword !== AIGC_KEY) continue;
    const parsed = parseJson(text);
    if (!parsed.ok || parsed.type !== 'object') continue;
    const producer = labelProducer(parsed.value);
    if (producer !== undefined) return producer;
  }
  return undefined;
}

/** The provider of a label wrapped as `{"AIGC": {...}}` in a UserComment. */
function producerInSegments(segments: MetadataSegment[]): string | undefined {
  for (const { source, data } of segments) {
    // The key is looked for first: a UserComment can hold megabytes of
    // other JSON (a ComfyUI workflow), which is not worth parsing here
    if (source.type !== 'exifUserComment' || !data.includes(`"${AIGC_KEY}"`)) {
      continue;
    }
    const parsed = parseJson(data);
    if (!parsed.ok || parsed.type !== 'object') continue;
    const producer = labelProducer(parsed.value[AIGC_KEY]);
    if (producer !== undefined) return producer;
  }
  return undefined;
}

/**
 * The `ContentProducer` of a value that has the shape of a label: an object
 * with a `Label` and a provider written as text
 */
function labelProducer(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const label = value as Record<string, unknown>;
  if (!Object.hasOwn(label, 'Label')) return undefined;
  return typeof label.ContentProducer === 'string'
    ? label.ContentProducer
    : undefined;
}

/** The vendor behind a provider name or code. */
function vendorOf(producer: string): Vendor {
  if (producer.includes(TENCENT_CREDIT_CODE)) return 'tencent';
  if (producer === KLING_PRODUCER) return 'kuaishou';
  return 'unknown';
}
