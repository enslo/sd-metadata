import type { EmbedMetadata, ParseResult } from '@enslo/sd-metadata';
import {
  Button,
  Divider,
  Group,
  Input,
  NativeSelect,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useStore } from '@nanostores/react';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { $t } from '../../i18n';
import {
  convertImageFormat,
  downloadBlob,
  generateFilename,
  getFormatLabel,
  getMimeType,
  type OutputFormat,
} from '../../lib/image';
import {
  applyMetadata,
  canKeepMetadata,
  defaultMode,
  describeWarning,
  isMetadataFormat,
  type MetadataFormat,
  type MetadataMode,
  toEmbedMetadata,
} from '../../lib/output';
import { ExtrasEditor } from './ExtrasEditor';
import { MetadataForm } from './MetadataForm';
import { MetadataPreview } from './MetadataPreview';

type TextChangeEvent = { currentTarget: { value: string } };

interface OutputTabProps {
  parseResult: ParseResult;
  fileDataRef: RefObject<Uint8Array | null>;
  filename: string;
}

const OUTPUT_FORMATS: OutputFormat[] = ['png', 'jpeg', 'webp'];

function isOutputFormat(v: string): v is OutputFormat {
  return (OUTPUT_FORMATS as string[]).includes(v);
}

/**
 * Output tab: choose how to handle the metadata (keep / strip / edit) and
 * save the loaded image in a chosen format. Writing into another image is
 * the Copy to Image tab.
 */
export function OutputTab({
  parseResult,
  fileDataRef,
  filename,
}: OutputTabProps) {
  const t = useStore($t);
  const [mode, setMode] = useState<MetadataMode>(() =>
    defaultMode(parseResult),
  );
  const [metadataFormat, setMetadataFormat] =
    useState<MetadataFormat>('original');
  const [metadata, setMetadata] = useState<EmbedMetadata>(() =>
    toEmbedMetadata(parseResult),
  );
  const [extras, setExtras] = useState<Record<string, string | number>>({});
  const [target, setTarget] = useState<OutputFormat>('png');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the last save had to leave out or change, shown under the button
  const [notices, setNotices] = useState<string[]>([]);
  // Bumped with each loaded image so the extras editor starts afresh
  const [editorGeneration, setEditorGeneration] = useState(0);

  // Metadata that can be re-embedded as-is (vendor declarations are read-only)
  const canKeep = canKeepMetadata(parseResult);

  // Re-initialize when a new image is loaded
  useEffect(() => {
    setMode(defaultMode(parseResult));
    setMetadataFormat('original');
    setMetadata(toEmbedMetadata(parseResult));
    setExtras({});
    setEditorGeneration((generation) => generation + 1);
    setError(null);
    setNotices([]);
  }, [parseResult]);

  const handleSave = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setNotices([]);
    try {
      const fileData = fileDataRef.current;
      if (!fileData) {
        throw new Error('File data is not available');
      }
      // Convert the loaded image via canvas, then write the metadata
      const converted = await convertImageFormat(fileData, target);
      const { data, suffix, warning } = applyMetadata(
        converted.data,
        parseResult,
        { mode, metadataFormat, metadata, extras },
      );
      const notes: string[] = [];
      if (converted.format !== target) {
        notes.push(
          t.outputTab.formatFallback
            .replace('{format}', getFormatLabel(target))
            .replace('{actual}', getFormatLabel(converted.format)),
        );
      }
      if (warning) notes.push(describeWarning(warning, t.outputTab));
      setNotices(notes);
      const blob = new Blob([data.slice()], {
        type: getMimeType(converted.format),
      });
      downloadBlob(blob, generateFilename(filename, converted.format, suffix));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }, [
    target,
    fileDataRef,
    mode,
    metadata,
    extras,
    metadataFormat,
    parseResult,
    filename,
    t,
  ]);

  const modeData = [
    { value: 'keep', label: t.outputTab.modeKeep, disabled: !canKeep },
    { value: 'strip', label: t.outputTab.modeStrip },
    { value: 'edit', label: t.outputTab.modeEdit },
  ];

  const metadataFormatData = [
    { value: 'original', label: t.outputTab.metadataFormatOriginal },
    { value: 'a1111', label: t.outputTab.metadataFormatA1111 },
  ];

  const targetData = OUTPUT_FORMATS.map((f) => ({
    value: f,
    label: f.toUpperCase(),
  }));

  return (
    <Stack gap="md">
      {/* Metadata handling */}
      <Group gap="md" align="flex-end">
        {/* Input.Wrapper gives the control the exact same label
            spacing as the NativeSelects, so the row aligns pixel-perfectly */}
        <Input.Wrapper label={t.outputTab.metadataMode}>
          <SegmentedControl
            // Keep the sm font, but pad the segments so the control is
            // exactly 36px tall like the selects: 4+4 root padding +
            // 5+5 label padding + 18 line box. The block-level root
            // drops it below the wrapper label (which is inline-block)
            // while fit-content keeps the width hugging the segments.
            styles={{
              root: { display: 'flex', width: 'fit-content' },
              label: { padding: '5px 14px', lineHeight: '18px' },
            }}
            value={mode}
            onChange={(value) => {
              if (value === 'keep' || value === 'strip' || value === 'edit') {
                setMode(value);
              }
            }}
            data={modeData}
          />
        </Input.Wrapper>
        {mode === 'keep' && (
          <NativeSelect
            label={t.outputTab.metadataFormat}
            data={metadataFormatData}
            value={metadataFormat}
            onChange={(e: TextChangeEvent) => {
              const value = e.currentTarget.value;
              if (isMetadataFormat(value)) setMetadataFormat(value);
            }}
            disabled={parseResult.status !== 'success'}
          />
        )}
      </Group>

      {/* Edit form */}
      {mode === 'edit' && (
        <>
          <MetadataForm metadata={metadata} onChange={setMetadata} />
          <ExtrasEditor
            key={editorGeneration}
            extras={extras}
            onChange={setExtras}
          />
          <MetadataPreview metadata={metadata} extras={extras} />
        </>
      )}

      <Divider />

      {/* Output format + save */}
      <Group gap="md" align="flex-end">
        <NativeSelect
          label={t.outputTab.outputFormat}
          data={targetData}
          value={target}
          onChange={(e: TextChangeEvent) => {
            const value = e.currentTarget.value;
            if (isOutputFormat(value)) setTarget(value);
          }}
        />
        <Button
          color="green"
          onClick={handleSave}
          loading={processing}
          style={{ flex: 1 }}
        >
          {processing ? t.outputTab.processing : t.outputTab.saveButton}
        </Button>
      </Group>

      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}
      {notices.map((notice) => (
        <Text key={notice} c="yellow" size="sm">
          {notice}
        </Text>
      ))}
    </Stack>
  );
}
