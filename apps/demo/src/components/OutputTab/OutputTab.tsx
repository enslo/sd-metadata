import type { EmbedMetadata, ParseResult } from '@enslo/sd-metadata';
import { embed, stringify, write } from '@enslo/sd-metadata';
import {
  Button,
  Code,
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
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { $t } from '../../i18n';
import {
  convertImageFormat,
  detectFormat,
  downloadBlob,
  generateFilename,
  getMimeType,
  type OutputFormat,
} from '../../lib/image';
import { ContentPanel } from '../ContentPanel';
import { ExtrasEditor } from './ExtrasEditor';
import { MetadataForm } from './MetadataForm';

type TextChangeEvent = { currentTarget: { value: string } };

interface OutputTabProps {
  parseResult: ParseResult;
  fileDataRef: RefObject<Uint8Array | null>;
  filename: string;
}

type MetadataMode = 'keep' | 'strip' | 'edit';
type MetadataFormat = 'original' | 'a1111';
type OutputTarget = OutputFormat | 'another';

const OUTPUT_TARGETS: OutputTarget[] = ['png', 'jpeg', 'webp', 'another'];
const METADATA_FORMATS: MetadataFormat[] = ['original', 'a1111'];

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

function isOutputTarget(v: string): v is OutputTarget {
  return (OUTPUT_TARGETS as string[]).includes(v);
}

function isMetadataFormat(v: string): v is MetadataFormat {
  return (METADATA_FORMATS as string[]).includes(v);
}

/** Pick the default metadata mode for a parse result */
function defaultMode(parseResult: ParseResult): MetadataMode {
  switch (parseResult.status) {
    case 'success':
    case 'unrecognized':
      return 'keep';
    case 'empty':
      return 'edit';
    default:
      return 'strip';
  }
}

/**
 * Output tab: choose how to handle metadata (keep / strip / edit) and
 * where to write it (converted formats or another uploaded image)
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
  const [target, setTarget] = useState<OutputTarget>('png');
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metadata that can be re-embedded as-is (C2PA is read-only in write())
  const canKeep =
    parseResult.status === 'success' || parseResult.status === 'unrecognized';

  // Re-initialize when a new image is loaded
  useEffect(() => {
    setMode(defaultMode(parseResult));
    setMetadataFormat('original');
    setMetadata(toEmbedMetadata(parseResult));
    setExtras({});
    setTargetFile(null);
    setError(null);
  }, [parseResult]);

  // Thumbnail preview for the uploaded target image
  useEffect(() => {
    if (!targetFile) {
      setTargetPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(targetFile);
    setTargetPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [targetFile]);

  // Live preview text for edit mode
  const previewText = useMemo(
    () => stringify({ ...metadata, extras }),
    [metadata, extras],
  );

  const handleSave = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      // Resolve the output image: convert the loaded image via canvas, or
      // use the uploaded target image untouched
      let baseData: Uint8Array;
      let mimeFormat: OutputFormat;

      if (target === 'another') {
        if (!targetFile) {
          throw new Error('No target image selected');
        }
        baseData = new Uint8Array(await targetFile.arrayBuffer());
        mimeFormat = detectFormat(targetFile.name);
      } else {
        const fileData = fileDataRef.current;
        if (!fileData) {
          throw new Error('File data is not available');
        }
        baseData = await convertImageFormat(fileData, target);
        mimeFormat = target;
      }

      let resultData: Uint8Array;
      let suffix: string;

      if (mode === 'strip') {
        const result = write(baseData, { status: 'empty' });
        if (!result.ok) throw new Error(result.error.type);
        resultData = result.value;
        suffix = '_noinfo';
      } else if (mode === 'edit') {
        const result = embed(baseData, { ...metadata, extras });
        if (!result.ok) throw new Error(result.error.type);
        resultData = result.value;
        suffix = '_edited';
      } else if (
        metadataFormat === 'a1111' &&
        parseResult.status === 'success'
      ) {
        const result = embed(baseData, parseResult.metadata);
        if (!result.ok) throw new Error(result.error.type);
        resultData = result.value;
        suffix = '_a1111';
      } else {
        const result = write(baseData, parseResult);
        if (!result.ok) throw new Error(result.error.type);
        resultData = result.value;
        suffix = target === 'another' ? '_embedded' : '';
      }

      const sourceName =
        target === 'another' && targetFile ? targetFile.name : filename;
      const outputFilename = generateFilename(sourceName, mimeFormat, suffix);
      const blob = new Blob([resultData.slice()], {
        type: getMimeType(mimeFormat),
      });
      downloadBlob(blob, outputFilename);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }, [
    target,
    targetFile,
    fileDataRef,
    mode,
    metadata,
    extras,
    metadataFormat,
    parseResult,
    filename,
  ]);

  // "Strip" x "another image" would only strip the target's own metadata,
  // which is out of scope here, so the two options lock each other out
  const modeData = [
    { value: 'keep', label: t.outputTab.modeKeep, disabled: !canKeep },
    {
      value: 'strip',
      label: t.outputTab.modeStrip,
      disabled: target === 'another',
    },
    { value: 'edit', label: t.outputTab.modeEdit },
  ];

  const metadataFormatData = [
    { value: 'original', label: t.outputTab.metadataFormatOriginal },
    { value: 'a1111', label: t.outputTab.metadataFormatA1111 },
  ];

  const targetData = [
    ...(['png', 'jpeg', 'webp'] as const).map((f) => ({
      value: f,
      label: f.toUpperCase(),
    })),
    {
      value: 'another',
      label: t.outputTab.formatAnotherImage,
      disabled: mode === 'strip',
    },
  ];

  const saveDisabled = target === 'another' && !targetFile;

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
        </>
      )}

      <Divider />

      {/* Output target + save */}
      <Group gap="md" align="flex-end">
        <NativeSelect
          label={t.outputTab.outputFormat}
          data={targetData}
          value={target}
          onChange={(e: TextChangeEvent) => {
            const value = e.currentTarget.value;
            if (isOutputTarget(value)) setTarget(value);
          }}
        />
        {target === 'another' && (
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
                style={{ maxWidth: '100%', minWidth: 0 }}
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
        )}
        <Button
          color="green"
          onClick={handleSave}
          loading={processing}
          disabled={saveDisabled}
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
    </Stack>
  );
}
