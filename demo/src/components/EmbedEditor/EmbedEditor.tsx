import { embed } from '@enslo/sd-metadata';
import type { EmbedMetadata, ParseResult } from '@enslo/sd-metadata';
import {
  Button,
  Code,
  Collapse,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { ChevronDown, ChevronUp, Pen } from 'lucide-preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { $t } from '../../i18n';
import {
  type OutputFormat,
  convertImageFormat,
  downloadBlob,
  generateFilename,
  getMimeType,
} from '../../lib/image';
import { ExtrasEditor } from './ExtrasEditor';
import { MetadataForm } from './MetadataForm';

interface EmbedEditorProps {
  parseResult: ParseResult;
  fileData: Uint8Array;
  filename: string;
}

const OUTPUT_FORMATS: OutputFormat[] = ['png', 'jpeg', 'webp'];

/**
 * Build initial EmbedMetadata from ParseResult
 */
function buildInitialMetadata(parseResult: ParseResult): EmbedMetadata {
  if (parseResult.status === 'success') {
    const m = parseResult.metadata;
    return {
      prompt: m.prompt,
      negativePrompt: m.negativePrompt,
      model: m.model ? { ...m.model } : undefined,
      sampling: m.sampling ? { ...m.sampling } : undefined,
      hires: m.hires ? { ...m.hires } : undefined,
      upscale: m.upscale ? { ...m.upscale } : undefined,
      width: m.width,
      height: m.height,
      characterPrompts:
        m.software === 'novelai' && m.characterPrompts
          ? m.characterPrompts.map((cp) => ({ ...cp }))
          : undefined,
    };
  }
  return {
    prompt: '',
    negativePrompt: '',
    width: 0,
    height: 0,
  };
}

/**
 * Build A1111-format preview text from EmbedMetadata and extras
 *
 * This mirrors the library's buildEmbedText() for the live preview.
 */
function buildPreviewText(
  metadata: EmbedMetadata,
  extras: Record<string, string | number>,
): string {
  const lines: string[] = [];

  // Positive prompt
  if (metadata.prompt) {
    lines.push(metadata.prompt);
  }

  // Character prompts
  if (metadata.characterPrompts?.length) {
    for (let i = 0; i < metadata.characterPrompts.length; i++) {
      const cp = metadata.characterPrompts[i];
      const coords = cp.center ? ` [${cp.center.x}, ${cp.center.y}]` : '';
      lines.push(`# Character ${i + 1}${coords}:`);
      lines.push(cp.prompt);
    }
  }

  // Negative prompt
  if (metadata.negativePrompt) {
    lines.push(`Negative prompt: ${metadata.negativePrompt}`);
  }

  // Settings line
  const fields: Record<string, string | number | undefined> = {
    Steps: metadata.sampling?.steps,
    Sampler: metadata.sampling?.sampler,
    'Schedule type': metadata.sampling?.scheduler,
    'CFG scale': metadata.sampling?.cfg,
    Seed: metadata.sampling?.seed,
    Size:
      metadata.width > 0 && metadata.height > 0
        ? `${metadata.width}x${metadata.height}`
        : undefined,
    'Model hash': metadata.model?.hash,
    Model: metadata.model?.name,
    'Clip skip': metadata.sampling?.clipSkip,
    'Denoising strength': metadata.hires?.denoise,
    'Hires upscale': metadata.hires?.scale ?? metadata.upscale?.scale,
    'Hires steps': metadata.hires?.steps,
    'Hires upscaler': metadata.hires?.upscaler ?? metadata.upscale?.upscaler,
  };

  const settingsParts = Object.entries({ ...fields, ...extras })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);

  if (settingsParts.length > 0) {
    lines.push(settingsParts.join(', '));
  }

  return lines.join('\n');
}

/**
 * Collapsible metadata editor with embed + download functionality
 */
export function EmbedEditor({
  parseResult,
  fileData,
  filename,
}: EmbedEditorProps) {
  const t = useStore($t);
  const [isExpanded, setIsExpanded] = useState(false);
  const [metadata, setMetadata] = useState<EmbedMetadata>(() =>
    buildInitialMetadata(parseResult),
  );
  const [extras, setExtras] = useState<Record<string, string | number>>({});
  const [targetFormat, setTargetFormat] = useState<OutputFormat>('png');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-initialize when a new image is loaded
  useEffect(() => {
    setMetadata(buildInitialMetadata(parseResult));
    setExtras({});
    setError(null);
  }, [parseResult]);

  // Live preview text
  const previewText = useMemo(
    () => buildPreviewText(metadata, extras),
    [metadata, extras],
  );

  const handleEmbed = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      // Convert image to target format via canvas
      const convertedData = await convertImageFormat(fileData, targetFormat);
      const result = embed(convertedData, metadata, extras);

      if (result.ok) {
        const outputFilename = generateFilename(filename, targetFormat);
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
    <Paper mt="lg" withBorder>
      <UnstyledButton
        w="100%"
        p="md"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <Group gap="sm" wrap="nowrap">
          <Pen size={18} />
          <div style={{ flex: 1 }}>
            <Group gap="xs">
              <Text fw={500}>{t.embedEditor.title}</Text>
              <Text size="sm" c="dimmed">
                — {t.embedEditor.description}
              </Text>
            </Group>
          </div>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </Group>
      </UnstyledButton>

      <Collapse in={isExpanded}>
        <Stack gap="md" p="md" pt={0}>
          <MetadataForm metadata={metadata} onChange={setMetadata} />
          <ExtrasEditor extras={extras} onChange={setExtras} />

          {/* Live Preview */}
          <Paper p="md" radius="sm" bg="var(--mantine-color-dark-8)">
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
          </Paper>

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
              {processing
                ? t.embedEditor.processing
                : t.embedEditor.embedButton}
            </Button>
          </Group>

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
