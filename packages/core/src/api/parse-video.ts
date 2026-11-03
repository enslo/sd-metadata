/**
 * Video parse API for sd-metadata
 *
 * Reads generation metadata and vendor declarations from MP4 / MOV and
 * WebM / MKV files. Only the boxes and elements that hold metadata are
 * read, so a Blob (a browser File, or Node's `fs.openAsBlob()`) is read in
 * small ranges instead of being loaded whole.
 */

import { parseMetadata } from '../parsers';
import { readC2paStore } from '../parsers/c2pa';
import type { VendorDeclaration } from '../parsers/types';
import { isXaiSignature, readXmpDeclaration } from '../parsers/vendor';
import { toByteSource } from '../readers/byte-source';
import { readVideoContainer } from '../readers/video';
import type { VideoContainer } from '../readers/video-container';
import type {
  VideoParseResult,
  VideoRawMetadata,
  VideoReadOptions,
  VideoTag,
} from '../types';
import { videoTagsToRecord } from '../utils/convert';

/**
 * Tags every encoder writes (ffmpeg's brand fields and version strings).
 * A file with nothing else carries no metadata of its own.
 */
const ENCODER_TAG_KEYS: ReadonlySet<string> = new Set([
  'major_brand',
  'minor_version',
  'compatible_brands',
  'encoder',
  '©too',
  '©swr',
]);

/** Label in front of xAI's signature in an MP4 `©cmt` comment. */
const SIGNATURE_LABEL = 'Signature: ';

/**
 * Read and parse metadata from a video
 *
 * Detects the container (MP4 / MOV or WebM / MKV) and parses embedded
 * generation metadata with the same parsers as images: ComfyUI's
 * `prompt` / `workflow` tags and the A1111-style text Forge writes. Without
 * generation metadata, a commercial AI service's declaration (C2PA, XMP,
 * xAI's signature) is reported as `vendor`.
 *
 * @example
 * ```typescript
 * import { parseVideo } from '@enslo/sd-metadata';
 *
 * // In a browser: pass the File itself; only metadata ranges are read.
 * const result = await parseVideo(file);
 * if (result.status === 'success') {
 *   console.log(result.metadata.prompt);
 * }
 * ```
 *
 * @param input - Video bytes, or a Blob / File
 * @param options - Read options
 * @returns Parse result containing metadata and raw tags
 */
export async function parseVideo(
  input: Uint8Array | ArrayBuffer | Blob,
  options?: VideoReadOptions,
): Promise<VideoParseResult> {
  let container: VideoContainer | null;
  try {
    container = await readVideoContainer(toByteSource(input));
  } catch {
    return { status: 'invalid', message: 'Failed to read the video file' };
  }
  if (!container) {
    return { status: 'invalid', message: 'Unknown video format' };
  }

  const raw: VideoRawMetadata = {
    format: container.format,
    tags: container.tags,
  };

  // 1. Generation metadata takes precedence.
  const entries = videoTagsToRecord(container.tags);
  if (Object.keys(entries).length > 0) {
    const parsed = parseMetadata(entries);
    if (parsed.ok) {
      const metadata = parsed.value;
      if (!options?.strict) {
        metadata.width = metadata.width || container.width;
        metadata.height = metadata.height || container.height;
      }
      return { status: 'success', metadata, raw };
    }
  }

  // 2. A vendor declaration.
  const declaration = detectVideoVendor(container);
  if (declaration) {
    return { status: 'vendor', info: { ...declaration, media: 'video' } };
  }

  // 3. Distinguish "only encoder tags" from "metadata in an unknown format".
  return container.tags.some((tag) => !isEncoderTag(tag))
    ? { status: 'unrecognized', raw }
    : { status: 'empty' };
}

/**
 * Vendor declaration in a video: C2PA first (the only source that names
 * the service), then XMP, then xAI's signature in an MP4 `©cmt` comment.
 */
function detectVideoVendor(
  container: VideoContainer,
): VendorDeclaration | null {
  const c2pa = container.c2paStore ? readC2paStore(container.c2paStore) : null;
  if (c2pa) return c2pa;

  const xmp = container.xmp ? readXmpDeclaration(container.xmp) : null;
  if (xmp) return xmp;

  const signed = container.tags.some(
    ({ key, value }) =>
      key === '©cmt' &&
      value.startsWith(SIGNATURE_LABEL) &&
      isXaiSignature(value.slice(SIGNATURE_LABEL.length)),
  );
  return signed ? { vendor: 'xai', source: 'signature' } : null;
}

function isEncoderTag({ key }: VideoTag): boolean {
  return ENCODER_TAG_KEYS.has(key.toLowerCase());
}
