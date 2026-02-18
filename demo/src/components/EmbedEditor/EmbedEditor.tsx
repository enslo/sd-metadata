import type { EmbedMetadata, ParseResult } from '@enslo/sd-metadata';
import { embed, stringify } from '@enslo/sd-metadata';
import { Button, Code, Group, NativeSelect, Stack, Text } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { $t } from '../../i18n';
import {
  convertImageFormat,
  downloadBlob,
  generateFilename,
  getMimeType,
  type OutputFormat,
} from '../../lib/image';
import { ContentPanel } from '../Results/ContentPanel';
import { ExtrasEditor } from './ExtrasEditor';
import { MetadataForm } from './MetadataForm';

interface EmbedEditorProps {
  parseResult: ParseResult;
  fileData: Uint8Array;
  filename: string;
}

const OUTPUT_FORMATS: OutputFormat[] = ['png', 'jpeg', 'webp'];

const EMPTY_METADATA: EmbedMetadata = {
  prompt: '',
  negativePrompt: '',
  width: 0,
  height: 0,
};

function toEmbedMetadata(parseResult: ParseResult): EmbedMetadata {
  if (parseResult.status !== 'success') return EMPTY_METADATA;
  return parseResult.metadata;
}

/**
 * Metadata editor with embed + download functionality
 */
export function EmbedEditor({
  parseResult,
  fileData,
  filename,
}: EmbedEditorProps) {
  const t = useStore($t);
  const [metadata, setMetadata] = useState<EmbedMetadata>(() =>
    toEmbedMetadata(parseResult),
  );
  const [extras, setExtras] = useState<Record<string, string | number>>({});
  const [targetFormat, setTargetFormat] = useState<OutputFormat>('png');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-initialize when a new image is loaded
  useEffect(() => {
    setMetadata(toEmbedMetadata(parseResult));
    setExtras({});
    setError(null);
  }, [parseResult]);

  // Live preview text
  const previewText = useMemo(
    () => stringify({ ...metadata, extras }),
    [metadata, extras],
  );

  const handleEmbed = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      // Convert image to target format via canvas
      const convertedData = await convertImageFormat(fileData, targetFormat);
      const result = embed(convertedData, { ...metadata, extras });

      if (result.ok) {
        const outputFilename = generateFilename(
          filename,
          targetFormat,
          '_edited',
        );
        const blob = new Blob([result.value.slice()], {
          type: getMimeType(targetFormat),
        });
        downloadBlob(blob, outputFilename);
      } else {
        setError(result.error.type);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }, [fileData, metadata, extras, targetFormat, filename]);

  const formatData = OUTPUT_FORMATS.map((f) => ({
    value: f,
    label: f.toUpperCase(),
  }));

  return (
    <Stack gap="md">
      <MetadataForm metadata={metadata} onChange={setMetadata} />
      <ExtrasEditor extras={extras} onChange={setExtras} />

      {/* Live Preview */}
      <ContentPanel>
        <Text
          size="xs"
          c="dimmed"
          tt="uppercase"
          mb="xs"
          style={{ letterSpacing: '0.05em' }}
        >
          {t.embedEditor.preview}
        </Text>
        {previewText ? (
          <Code
            block
            styles={{
              root: {
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
            {t.embedEditor.previewEmpty}
          </Text>
        )}
      </ContentPanel>

      {/* Actions */}
      <Group>
        <NativeSelect
          data={formatData}
          value={targetFormat}
          onChange={(e: { currentTarget: { value: string } }) =>
            setTargetFormat(e.currentTarget.value as OutputFormat)
          }
          aria-label={t.embedEditor.format}
        />
        <Button
          color="green"
          onClick={handleEmbed}
          loading={processing}
          style={{ flex: 1 }}
        >
          {processing ? t.embedEditor.processing : t.embedEditor.embedButton}
        </Button>
      </Group>

      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}
    </Stack>
  );
}
