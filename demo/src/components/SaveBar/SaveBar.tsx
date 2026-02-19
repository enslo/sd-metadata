import type { ParseResult } from '@enslo/sd-metadata';
import { embed, write } from '@enslo/sd-metadata';
import { Button, Group, NativeSelect, Switch, Text } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { useCallback, useState } from 'preact/hooks';
import { $t } from '../../i18n';
import {
  convertImageFormat,
  downloadBlob,
  generateFilename,
  getMimeType,
  type OutputFormat,
} from '../../lib/image';

type TextChangeEvent = { currentTarget: { value: string } };
type CheckboxChangeEvent = { currentTarget: { checked: boolean } };

interface SaveBarProps {
  parseResult: ParseResult;
  previewUrl: string;
  filename: string;
}

type MetadataFormat = 'original' | 'a1111';

const OUTPUT_FORMATS: OutputFormat[] = ['png', 'jpeg', 'webp'];
const METADATA_FORMATS: MetadataFormat[] = ['original', 'a1111'];

function isOutputFormat(v: string): v is OutputFormat {
  return (OUTPUT_FORMATS as string[]).includes(v);
}

function isMetadataFormat(v: string): v is MetadataFormat {
  return (METADATA_FORMATS as string[]).includes(v);
}

/**
 * Inline save bar with metadata and format options
 */
export function SaveBar({ parseResult, previewUrl, filename }: SaveBarProps) {
  const t = useStore($t);
  const [keepMetadata, setKeepMetadata] = useState(true);
  const [metadataFormat, setMetadataFormat] =
    useState<MetadataFormat>('original');
  const [targetFormat, setTargetFormat] = useState<OutputFormat>('png');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMetadata =
    parseResult.status === 'success' || parseResult.status === 'unrecognized';

  const handleSave = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      const convertedData = await convertImageFormat(
        await fetchAsUint8Array(previewUrl),
        targetFormat,
      );

      let resultData: Uint8Array;
      let suffix = '';

      if (!keepMetadata || !hasMetadata) {
        // Strip metadata
        const writeResult = write(convertedData, { status: 'empty' });
        if (!writeResult.ok) {
          throw new Error(writeResult.error.type);
        }
        resultData = writeResult.value;
        suffix = '_noinfo';
      } else if (
        metadataFormat === 'a1111' &&
        parseResult.status === 'success'
      ) {
        // Embed as A1111 format
        const embedResult = embed(convertedData, parseResult.metadata);
        if (!embedResult.ok) {
          throw new Error(embedResult.error.type);
        }
        resultData = embedResult.value;
        suffix = '_a1111';
      } else {
        // Keep original metadata
        const writeResult = write(convertedData, parseResult);
        if (!writeResult.ok) {
          throw new Error(writeResult.error.type);
        }
        resultData = writeResult.value;
      }

      const outputFilename = generateFilename(filename, targetFormat, suffix);
      const blob = new Blob([resultData.slice()], {
        type: getMimeType(targetFormat),
      });
      downloadBlob(blob, outputFilename);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }, [
    previewUrl,
    parseResult,
    keepMetadata,
    metadataFormat,
    targetFormat,
    filename,
    hasMetadata,
  ]);

  const formatData = OUTPUT_FORMATS.map((f) => ({
    value: f,
    label: f.toUpperCase(),
  }));

  const metadataFormatData = [
    { value: 'original', label: t.saveBar.metadataFormatOriginal },
    { value: 'a1111', label: t.saveBar.metadataFormatA1111 },
  ];

  return (
    <Group gap="md" align="center">
      <Switch
        checked={keepMetadata}
        onChange={(e: CheckboxChangeEvent) =>
          setKeepMetadata(e.currentTarget.checked)
        }
        label={t.saveBar.keepMetadata}
        labelPosition="left"
        disabled={!hasMetadata}
      />
      <NativeSelect
        data={metadataFormatData}
        value={metadataFormat}
        onChange={(e: TextChangeEvent) => {
          const value = e.currentTarget.value;
          if (isMetadataFormat(value)) setMetadataFormat(value);
        }}
        disabled={!keepMetadata || !hasMetadata}
        aria-label={t.saveBar.metadataFormat}
      />
      <NativeSelect
        data={formatData}
        value={targetFormat}
        onChange={(e: TextChangeEvent) => {
          const value = e.currentTarget.value;
          if (isOutputFormat(value)) setTargetFormat(value);
        }}
        aria-label={t.saveBar.outputFormat}
      />
      <Button
        color="green"
        onClick={handleSave}
        loading={processing}
        style={{ flex: 1 }}
      >
        {processing ? t.saveBar.processing : t.saveBar.saveButton}
      </Button>
      {error && (
        <Text c="red" size="sm" style={{ width: '100%' }}>
          {error}
        </Text>
      )}
    </Group>
  );
}

/**
 * Fetch a blob URL as Uint8Array
 */
async function fetchAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
