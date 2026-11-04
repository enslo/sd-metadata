import type { EmbedMetadata, ParseResult } from '@enslo/sd-metadata';
import {
  Button,
  Divider,
  FileButton,
  Group,
  Image,
  Input,
  NativeSelect,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useStore } from '@nanostores/react';
import { ImageUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { $t } from '../../i18n';
import {
  detectFormat,
  downloadBlob,
  generateFilename,
  getFormatLabel,
  getMimeType,
} from '../../lib/image';
import {
  applyMetadata,
  canKeepMetadata,
  isMetadataFormat,
  type MetadataFormat,
  toEmbedMetadata,
} from '../../lib/output';
import { ExtrasEditor, MetadataForm, MetadataPreview } from '../OutputTab';

type TextChangeEvent = { currentTarget: { value: string } };

interface CopyToImageTabProps {
  parseResult: ParseResult;
}

/** Keep the loaded metadata or write an edited form; stripping is not a copy */
type CopyMode = 'keep' | 'edit';

/**
 * Copy to Image tab: write the loaded image's metadata into another
 * uploaded image. The target keeps its pixels and format; only its
 * metadata is replaced.
 */
export function CopyToImageTab({ parseResult }: CopyToImageTabProps) {
  const t = useStore($t);
  const canKeep = canKeepMetadata(parseResult);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<CopyMode>(() => (canKeep ? 'keep' : 'edit'));
  const [metadataFormat, setMetadataFormat] =
    useState<MetadataFormat>('original');
  const [metadata, setMetadata] = useState<EmbedMetadata>(() =>
    toEmbedMetadata(parseResult),
  );
  const [extras, setExtras] = useState<Record<string, string | number>>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-initialize when a new image is loaded
  useEffect(() => {
    setMode(canKeepMetadata(parseResult) ? 'keep' : 'edit');
    setMetadataFormat('original');
    setMetadata(toEmbedMetadata(parseResult));
    setExtras({});
    setTargetFile(null);
    setError(null);
  }, [parseResult]);

  // Thumbnail preview for the target image
  useEffect(() => {
    if (!targetFile) {
      setTargetPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(targetFile);
    setTargetPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [targetFile]);

  const handleSave = useCallback(async () => {
    if (!targetFile) return;
    setProcessing(true);
    setError(null);
    try {
      const format = detectFormat(targetFile.name);
      const baseData = new Uint8Array(await targetFile.arrayBuffer());
      const { data, suffix } = applyMetadata(baseData, parseResult, {
        mode,
        metadataFormat,
        metadata,
        extras,
      });
      const blob = new Blob([data.slice()], { type: getMimeType(format) });
      downloadBlob(
        blob,
        generateFilename(targetFile.name, format, suffix || '_embedded'),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }, [targetFile, mode, metadataFormat, metadata, extras, parseResult]);

  const modeData = [
    { value: 'keep', label: t.outputTab.modeKeep, disabled: !canKeep },
    { value: 'edit', label: t.outputTab.modeEdit },
  ];

  const metadataFormatData = [
    { value: 'original', label: t.outputTab.metadataFormatOriginal },
    { value: 'a1111', label: t.outputTab.metadataFormatA1111 },
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t.copyTab.description}
      </Text>

      {/* Target image */}
      <Group gap="md" align="flex-end">
        <Input.Wrapper label={t.copyTab.targetImage}>
          <FileButton
            onChange={(file) => {
              setTargetFile(file);
              setError(null);
            }}
            accept="image/png,image/jpeg,image/webp"
          >
            {(props) => (
              <Button
                {...props}
                variant="default"
                leftSection={
                  targetPreviewUrl ? (
                    <Image
                      src={targetPreviewUrl}
                      alt=""
                      h={24}
                      w={24}
                      fit="cover"
                      radius="xs"
                    />
                  ) : (
                    <ImageUp size={16} />
                  )
                }
                style={{ display: 'flex', maxWidth: '100%', minWidth: 0 }}
                styles={{ label: { minWidth: 0 } }}
              >
                {/* The label keeps Mantine's default flex centering;
                    the inner span owns the ellipsis so descenders are
                    never clipped by the label's line box */}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    lineHeight: 'normal',
                  }}
                >
                  {targetFile ? targetFile.name : t.outputTab.selectImage}
                </span>
              </Button>
            )}
          </FileButton>
        </Input.Wrapper>
        {targetFile && (
          <Text size="sm" c="dimmed" pb={8}>
            {getFormatLabel(detectFormat(targetFile.name))}
          </Text>
        )}
      </Group>

      <Divider />

      {/* Metadata handling */}
      <Group gap="md" align="flex-end">
        <Input.Wrapper label={t.outputTab.metadataMode}>
          <SegmentedControl
            styles={{
              root: { display: 'flex', width: 'fit-content' },
              label: { padding: '5px 14px', lineHeight: '18px' },
            }}
            value={mode}
            onChange={(value) => {
              if (value === 'keep' || value === 'edit') setMode(value);
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

      {mode === 'edit' && (
        <>
          <MetadataForm metadata={metadata} onChange={setMetadata} />
          <ExtrasEditor extras={extras} onChange={setExtras} />
          <MetadataPreview metadata={metadata} extras={extras} />
        </>
      )}

      <Button
        color="green"
        onClick={handleSave}
        loading={processing}
        disabled={!targetFile}
      >
        {processing ? t.outputTab.processing : t.outputTab.saveButton}
      </Button>

      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}
    </Stack>
  );
}
