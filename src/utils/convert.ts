import type {
  MetadataEntry,
  MetadataSegment,
  MetadataSegmentSource,
  PngTextChunk,
} from '../types';
import { parseJson } from './json';

/**
 * Convert PNG text chunks to format-agnostic metadata entries
 *
 * @param chunks - PNG tEXt/iTXt chunks
 * @returns Array of metadata entries
 */
export function pngChunksToEntries(chunks: PngTextChunk[]): MetadataEntry[] {
  return chunks.map((chunk) => ({
    keyword: chunk.keyword,
    text: chunk.text,
  }));
}

/**
 * Convert JPEG/WebP metadata segments to format-agnostic entries
 *
 * Maps segment sources to conventional keywords:
 * - jpegCom → 'Comment'
 * - exifUserComment → 'Comment' (or expand if NovelAI WebP format)
 * - exifImageDescription → prefix or 'Description'
 * - exifMake → prefix or 'Make'
 *
 * Special handling for NovelAI WebP format where metadata is stored as:
 * {"Comment": "{...inner JSON...}", "Software": "NovelAI", ...}
 *
 * @param segments - Metadata segments from JPEG/WebP reader
 * @returns Array of metadata entries
 */
export function segmentsToEntries(
  segments: MetadataSegment[],
): MetadataEntry[] {
  const entries: MetadataEntry[] = [];

  for (const segment of segments) {
    const keyword = sourceToKeyword(segment.source);
    const text = segment.data;

    // Try to detect and expand NovelAI WebP format
    // Format: {"Comment": "{...}", "Software": "NovelAI", ...}
    if (segment.source.type === 'exifUserComment' && text.startsWith('{')) {
      const expanded = tryExpandNovelAIWebpFormat(text);
      if (expanded) {
        entries.push(...expanded);
        continue;
      }
    }

    entries.push({ keyword, text });
  }

  return entries;
}

/**
 * Try to expand NovelAI WebP format metadata
 *
 * NovelAI WebP stores metadata as outer JSON with:
 * - Software: "NovelAI"
 * - Comment: inner JSON string with actual parameters
 *
 * @param text - JSON text to try to expand
 * @returns Array of entries if NovelAI format, null otherwise
 */
function tryExpandNovelAIWebpFormat(text: string): MetadataEntry[] | null {
  const outerParsed = parseJson<Record<string, unknown>>(text);
  if (!outerParsed.ok) {
    return null;
  }

  const outer = outerParsed.value;

  // Check if this is NovelAI WebP format
  if (
    typeof outer !== 'object' ||
    outer === null ||
    (typeof outer.Software === 'string' &&
      !outer.Software.startsWith('NovelAI')) ||
    typeof outer.Comment !== 'string'
  ) {
    return null;
  }

  const entries: MetadataEntry[] = [{ keyword: 'Software', text: 'NovelAI' }];

  // Parse and add inner Comment as Comment entry
  const innerParsed = parseJson<unknown>(outer.Comment);

  return [
    ...entries,
    innerParsed.ok
      ? { keyword: 'Comment', text: JSON.stringify(innerParsed.value) }
      : { keyword: 'Comment', text: outer.Comment },
  ];
}

/**
 * Map metadata segment source to keyword
 */
function sourceToKeyword(source: MetadataSegmentSource): string {
  switch (source.type) {
    case 'jpegCom':
      return 'Comment';
    case 'exifUserComment':
      return 'Comment';
    case 'exifImageDescription':
      return source.prefix ?? 'Description';
    case 'exifMake':
      return source.prefix ?? 'Make';
    case 'exifSoftware':
      return 'Software';
    case 'exifDocumentName':
      return 'Title';
  }
}
