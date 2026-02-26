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
  if (parseResult.status === 'empty') {
    return <ErrorMessage message={t.results.errors.noRawData} />;
  }

  if (parseResult.raw.format === 'png') {
    const { chunks } = parseResult.raw;
    const defaultValues = chunks.map((c) => c.keyword);
    return (
      <Accordion multiple variant="separated" defaultValue={defaultValues}>
        {chunks.map((chunk: PngTextChunk) => {
          const { formatted, isJson } = formatJson(chunk.text);
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
        })}
      </Accordion>
    );
  }

  const { segments } = parseResult.raw;
  const defaultValues = segments.map((s) => s.source.type);
  return (
    <Accordion multiple variant="separated" defaultValue={defaultValues}>
      {segments.map((segment: MetadataSegment) => {
        const { formatted, isJson } = formatJson(segment.data);
        return (
          <Accordion.Item value={segment.source.type} key={segment.source.type}>
            <Accordion.Control>
              <Group gap="xs">
                <span>{SOURCE_LABELS[segment.source.type]}</span>
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
      })}
    </Accordion>
  );
}
