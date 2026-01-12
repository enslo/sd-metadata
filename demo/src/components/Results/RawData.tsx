import type { RawMetadata } from '@enslo/sd-metadata';
import { formatJson } from '../../utils';
import styles from './Results.module.css';

// Type aliases derived from RawMetadata
type PngTextChunk = Extract<RawMetadata, { format: 'png' }>['chunks'][number];
type MetadataSegment = Extract<
  RawMetadata,
  { format: 'jpeg' }
>['segments'][number];

interface RawChunksProps {
  chunks: PngTextChunk[];
}

/**
 * Get text content from PNG text chunk
 */
function getChunkText(chunk: PngTextChunk): string {
  return chunk.text;
}

/**
 * Display raw PNG text chunks as accordion
 */
export function RawChunks({ chunks }: RawChunksProps) {
  return (
    <div class={styles.rawData}>
      {chunks.map((chunk) => {
        const { formatted, isJson } = formatJson(getChunkText(chunk));
        return (
          <details class={styles.rawChunk} open key={chunk.keyword}>
            <summary class={styles.rawChunkHeader}>
              <span class={styles.chunkInfo}>
                <span class={styles.chunkKeyword}>{chunk.keyword}</span>
                <span class={styles.chunkBadge}>{chunk.type}</span>
                {isJson && <span class={styles.chunkBadge}>JSON</span>}
              </span>
            </summary>
            <pre class={styles.chunkContent}>{formatted}</pre>
          </details>
        );
      })}
    </div>
  );
}

interface ExifSegmentsProps {
  segments: MetadataSegment[];
}

/**
 * Display EXIF metadata segments as accordion
 */
export function ExifSegments({ segments }: ExifSegmentsProps) {
  return (
    <div class={styles.rawData}>
      {segments.map((segment) => {
        const { formatted, isJson } = formatJson(segment.data);
        const sourceLabel = getSourceLabel(segment.source);
        return (
          <details class={styles.rawChunk} open key={segment.source}>
            <summary class={styles.rawChunkHeader}>
              <span class={styles.chunkInfo}>
                <span class={styles.chunkKeyword}>{sourceLabel}</span>
                {isJson && <span class={styles.chunkBadge}>JSON</span>}
              </span>
            </summary>
            <pre class={styles.chunkContent}>{formatted}</pre>
          </details>
        );
      })}
    </div>
  );
}

/**
 * Get human-readable label for segment source
 */
function getSourceLabel(source: MetadataSegment['source']): string {
  switch (source.type) {
    case 'exifUserComment':
      return 'EXIF: UserComment';
    case 'exifImageDescription':
      return 'EXIF: ImageDescription';
    case 'exifMake':
      return 'EXIF: Make';
    case 'jpegCom':
      return 'JPEG COM';
    default:
      return 'Unknown';
  }
}
