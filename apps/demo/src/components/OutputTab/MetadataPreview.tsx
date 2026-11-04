import type { EmbedMetadata } from '@enslo/sd-metadata';
import { stringify } from '@enslo/sd-metadata';
import { Code, Text } from '@mantine/core';
import { useStore } from '@nanostores/react';
import { useMemo } from 'react';
import { $t } from '../../i18n';
import { ContentPanel } from '../ContentPanel';

interface MetadataPreviewProps {
  metadata: EmbedMetadata;
  extras: Record<string, string | number>;
}

/** Live A1111-text preview of the metadata being edited */
export function MetadataPreview({ metadata, extras }: MetadataPreviewProps) {
  const t = useStore($t);
  const previewText = useMemo(
    () => stringify({ ...metadata, extras }),
    [metadata, extras],
  );

  return (
    <ContentPanel>
      <Text
        size="xs"
        c="dimmed"
        tt="uppercase"
        mb="xs"
        style={{ letterSpacing: '0.05em' }}
      >
        {t.outputTab.preview}
      </Text>
      {previewText ? (
        <Code
          block
          styles={{
            root: {
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
              background: 'transparent',
              padding: 0,
            },
          }}
        >
          {previewText}
        </Code>
      ) : (
        <Text size="sm" c="dimmed" ta="center">
          {t.outputTab.previewEmpty}
        </Text>
      )}
    </ContentPanel>
  );
}
