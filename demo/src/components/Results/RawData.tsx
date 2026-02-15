import type { RawMetadata } from '@enslo/sd-metadata';
import { Accordion, Badge, Group } from '@mantine/core';
import { formatJson } from '../../utils';

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
  const defaultValues = chunks.map((c) => c.keyword);

  return (
    <Accordion multiple defaultValue={defaultValues}>
      {chunks.map((chunk) => {
        const { formatted, isJson } = formatJson(getChunkText(chunk));
        return (
          <Accordion.Item value={chunk.keyword} key={chunk.keyword}>
            <Accordion.Control>
              <Group gap="xs">
                <span>{chunk.keyword}</span>
                <Badge size="xs" variant="light">
                  {chunk.type}
                </Badge>
                {isJson && (
                  <Badge size="xs" variant="light" color="teal">
                    JSON
                  </Badge>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <pre
                style={{
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {formatted}
              </pre>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

interface ExifSegmentsProps {
  segments: MetadataSegment[];
}

/**
 * Display EXIF metadata segments as accordion
 */
export function ExifSegments({ segments }: ExifSegmentsProps) {
  const defaultValues = segments.map((s) => s.source.type);

  return (
    <Accordion multiple defaultValue={defaultValues}>
      {segments.map((segment) => {
        const { formatted, isJson } = formatJson(segment.data);
        const sourceLabel = getSourceLabel(segment.source);
        return (
          <Accordion.Item value={segment.source.type} key={segment.source.type}>
            <Accordion.Control>
              <Group gap="xs">
                <span>{sourceLabel}</span>
                {isJson && (
                  <Badge size="xs" variant="light" color="teal">
                    JSON
                  </Badge>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <pre
                style={{
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {formatted}
              </pre>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
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
