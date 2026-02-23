import type {
  MetadataSegment,
  MetadataSegmentSource,
  PngTextChunk,
} from '../types';
import type { EntryRecord } from './entries';
import { parseJson } from './json';

/**
 * Convert PNG text chunks to entry record
 *
 * @param chunks - PNG tEXt/iTXt chunks
 * @returns Entry record for keyword lookup
 */
export function pngChunksToRecord(chunks: PngTextChunk[]): EntryRecord {
  return Object.fromEntries(chunks.map((c) => [c.keyword, c.text]));
}

/**
 * Convert JPEG/WebP metadata segments to entry record
 *
 * Maps segment sources to conventional keywords:
 * - jpegCom → 'Comment'
 * - exifUserComment → 'UserComment' (or expand if NovelAI WebP format)
 * - exifImageDescription → prefix or 'ImageDescription'
 * - exifMake → prefix or 'Make'
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

    // Try to detect and expand NovelAI WebP format
    // Format: {"Comment": "{...}", "Software": "NovelAI", ...}
    if (segment.source.type === 'exifUserComment' && text.startsWith('{')) {
      const expanded = tryExpandNovelAIWebpFormat(text);
      if (expanded) {
        Object.assign(record, expanded);
        continue;
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
  }
}
