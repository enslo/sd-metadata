import type {
  MetadataSegment,
  MetadataSegmentSource,
  PngTextChunk,
  VideoTag,
} from '../types';
import type { EntryRecord } from './entries';
import { parseJson } from './json';
import { extractXmpEntries, isXmpKeyword } from './xmp';

/**
 * Convert PNG text chunks to entry record
 *
 * @param chunks - PNG tEXt/iTXt chunks
 * @returns Entry record for keyword lookup
 */
export function pngChunksToRecord(chunks: PngTextChunk[]): EntryRecord {
  return Object.fromEntries(
    chunks.flatMap((chunk) => {
      // Expand XMP metadata into individual entries
      if (isXmpKeyword(chunk.keyword)) {
        const expanded = extractXmpEntries(chunk.text);
        if (expanded) return Object.entries(expanded);
      }
      return [[chunk.keyword, chunk.text]];
    }),
  );
}

/**
 * Convert PNG raw metadata to an entry record
 *
 * Text chunks map by keyword; the segments of an `eXIf` chunk map exactly
 * like JPEG/WebP segments (UserComment, Make, ...), so a CivitAI PNG yields
 * the same entries as its JPEG counterpart.
 *
 * @param raw - PNG text chunks plus optional eXIf segments
 * @returns Entry record for keyword lookup
 */
export function pngRawToRecord(raw: {
  chunks: PngTextChunk[];
  exif?: MetadataSegment[];
}): EntryRecord {
  return {
    ...pngChunksToRecord(raw.chunks),
    ...(raw.exif ? segmentsToRecord(raw.exif) : {}),
  };
}

/**
 * Convert JPEG/WebP metadata segments to entry record
 *
 * Maps segment sources to conventional keywords:
 * - jpegCom → 'Comment'
 * - exifUserComment → 'UserComment' (or expand if NovelAI WebP format)
 * - exifImageDescription → prefix or 'ImageDescription'
 * - exifMake → prefix or 'Make'
 * - exifModel → prefix or 'Model'
 *
 * Special handling for NovelAI WebP format where metadata is stored as:
 * {"Comment": "{...inner JSON...}", "Software": "NovelAI", ...}
 *
 * @param segments - Metadata segments from JPEG/WebP reader
 * @returns Entry record for keyword lookup
 */
export function segmentsToRecord(segments: MetadataSegment[]): EntryRecord {
  const record: Record<string, string> = {};

  for (const segment of segments) {
    const keyword = sourceToKeyword(segment.source);
    const text = segment.data;

    // Expand XMP packet into individual entries
    if (segment.source.type === 'xmpPacket') {
      const expanded = extractXmpEntries(text);
      if (expanded) {
        Object.assign(record, expanded);
        continue;
      }
    }

    if (segment.source.type === 'exifUserComment') {
      // Try to detect and expand NovelAI WebP format
      // Format: {"Comment": "{...}", "Software": "NovelAI", ...}
      if (text.startsWith('{')) {
        const expanded = tryExpandNovelAIWebpFormat(text);
        if (expanded) {
          Object.assign(record, expanded);
          continue;
        }
      }
    }

    record[keyword] = text;
  }

  return record;
}

/**
 * Try to expand NovelAI WebP format metadata
 *
 * NovelAI WebP stores metadata as outer JSON with:
 * - Software: "NovelAI"
 * - Comment: inner JSON string with actual parameters
 *
 * @param text - JSON text to try to expand
 * @returns Entry record if NovelAI format, null otherwise
 */
function tryExpandNovelAIWebpFormat(text: string): EntryRecord | null {
  const outerParsed = parseJson(text);
  if (!outerParsed.ok || outerParsed.type !== 'object') {
    return null;
  }

  const outer = outerParsed.value;

  // Check if this is NovelAI WebP format
  if (
    (typeof outer.Software === 'string' &&
      !outer.Software.startsWith('NovelAI')) ||
    typeof outer.Comment !== 'string'
  ) {
    return null;
  }

  // Parse and add inner Comment as Comment entry
  const innerParsed = parseJson(outer.Comment);

  return {
    Software: typeof outer.Software === 'string' ? outer.Software : 'NovelAI',
    Comment: innerParsed.ok ? JSON.stringify(innerParsed.value) : outer.Comment,
  };
}

/**
 * Map metadata segment source to keyword
 */
function sourceToKeyword(source: MetadataSegmentSource): string {
  switch (source.type) {
    case 'jpegCom':
      return 'Comment';
    case 'exifUserComment':
      return 'UserComment';
    case 'exifImageDescription':
      return source.prefix ?? 'ImageDescription';
    case 'exifMake':
      return source.prefix ?? 'Make';
    case 'exifModel':
      return source.prefix ?? 'Model';
    case 'xmpPacket':
      return 'XML:com.adobe.xmp';
  }
}

/**
 * Video tag keys mapped to the entry keys the image parsers read.
 *
 * Matched case-insensitively: ComfyUI writes `workflow` / `prompt` as MP4
 * mdta keys and `WORKFLOW` / `PROMPT` as Matroska tags; Forge Neo writes
 * its A1111 text as MP4 `desc` and Matroska `DESCRIPTION`.
 */
const VIDEO_TAG_ENTRIES: ReadonlyMap<string, string> = new Map([
  ['prompt', 'prompt'],
  ['workflow', 'workflow'],
  ['desc', 'parameters'],
  ['description', 'parameters'],
]);

/**
 * Convert video tags to an entry record for the image parsers
 *
 * Only the tags in {@link VIDEO_TAG_ENTRIES} are mapped; the first of each
 * entry wins.
 *
 * @param tags - Video text tags
 * @returns Entry record for keyword lookup
 */
export function videoTagsToRecord(tags: VideoTag[]): EntryRecord {
  const record: Record<string, string> = {};
  for (const { key, value } of tags) {
    const entry = VIDEO_TAG_ENTRIES.get(key.toLowerCase());
    if (entry !== undefined && !Object.hasOwn(record, entry)) {
      record[entry] = value;
    }
  }
  return record;
}
