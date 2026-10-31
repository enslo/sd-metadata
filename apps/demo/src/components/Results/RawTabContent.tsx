import type {
  MetadataSegment,
  ParseResult,
  PngTextChunk,
} from '@enslo/sd-metadata';
import { Accordion, Badge, Group } from '@mantine/core';
import type { I18nMessages } from '../../i18n';
import { formatJson } from '../../utils';
import { ContentPanel } from '../ContentPanel';
import { ErrorMessage } from './ErrorMessage';

const SOURCE_LABELS: Record<MetadataSegment['source']['type'], string> = {
  exifUserComment: 'EXIF: UserComment',
  exifImageDescription: 'EXIF: ImageDescription',
  exifMake: 'EXIF: Make',
  exifModel: 'EXIF: Model',
  jpegCom: 'JPEG COM',
  xmpPacket: 'XMP Packet',
};

interface RawTabContentProps {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
  t: I18nMessages;
}

/**
 * @package
 * Tab content for the raw PNG chunks / EXIF segments view
 */
export function RawTabContent({ parseResult, t }: RawTabContentProps) {
  if (parseResult.status === 'empty' || parseResult.status === 'c2pa') {
    // C2PA results carry no raw text chunks/segments to display.
    return <ErrorMessage message={t.results.errors.noRawData} />;
  }

  if (parseResult.raw.format === 'png') {
    // CivitAI PNGs keep their EXIF in an eXIf chunk; list those segments
    // after the text chunks, tagged with the chunk type like the others.
    const { chunks, exif = [] } = parseResult.raw;
    const exifValue = (segment: MetadataSegment) =>
      `eXIf:${segment.source.type}`;
    const defaultValues = [
      ...chunks.map((c) => c.keyword),
      ...exif.map(exifValue),
    ];
    return (
      <Accordion multiple variant="separated" defaultValue={defaultValues}>
        {chunks.map((chunk: PngTextChunk) => (
          <RawItem
            key={chunk.keyword}
            value={chunk.keyword}
            label={chunk.keyword}
            badge={chunk.type}
            text={chunk.text}
          />
        ))}
        {exif.map((segment) => (
          <RawItem
            key={exifValue(segment)}
            value={exifValue(segment)}
            label={SOURCE_LABELS[segment.source.type]}
            badge="eXIf"
            text={segment.data}
          />
        ))}
      </Accordion>
    );
  }

  const { segments } = parseResult.raw;
  const defaultValues = segments.map((s) => s.source.type);
  return (
    <Accordion multiple variant="separated" defaultValue={defaultValues}>
      {segments.map((segment: MetadataSegment) => (
        <RawItem
          key={segment.source.type}
          value={segment.source.type}
          label={SOURCE_LABELS[segment.source.type]}
          text={segment.data}
        />
      ))}
    </Accordion>
  );
}

interface RawItemProps {
  value: string;
  label: string;
  /** Container the data came from (PNG chunk type), shown as a badge */
  badge?: string;
  text: string;
}

/**
 * One collapsible raw entry: a PNG text chunk, an eXIf segment, or a
 * JPEG/WebP segment
 */
function RawItem({ value, label, badge, text }: RawItemProps) {
  const { formatted, isJson } = formatJson(text);
  return (
    <Accordion.Item value={value}>
      <Accordion.Control>
        <Group gap="xs">
          <span>{label}</span>
          {badge && (
            <Badge size="xs" variant="light">
              {badge}
            </Badge>
          )}
          {isJson && (
            <Badge size="xs" variant="light" color="teal">
              JSON
            </Badge>
          )}
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <ContentPanel>
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
        </ContentPanel>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
