import type { ParseResult } from '@enslo/sd-metadata';
import { write } from '@enslo/sd-metadata';
import {
  Badge,
  Button,
  FileButton,
  Group,
  Image,
  Input,
  Paper,
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
  sniffFormat,
} from '../../lib/image';
import { describeWarning } from '../../lib/output';

interface CopyToImageTabProps {
  parseResult: ParseResult;
}

/**
 * Copy tab: write the loaded image's metadata, as it is, into another
 * uploaded image. The target keeps its pixels and format; only its
 * metadata is replaced.
 *
 * The target is picked with a click, not a drop zone: the page already
 * takes drops anywhere to replace the loaded image, and a second drop
 * target would compete with that.
 */
export function CopyToImageTab({ parseResult }: CopyToImageTabProps) {
  const t = useStore($t);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the last save had to leave out, shown under the button
  const [notice, setNotice] = useState<string | null>(null);

  // Re-initialize when a new image is loaded
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on parseResult change
  useEffect(() => {
    setTargetFile(null);
    setError(null);
    setNotice(null);
  }, [parseResult]);

  // Preview for the target image
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
    setNotice(null);
    try {
      const baseData = new Uint8Array(await targetFile.arrayBuffer());
      // write() goes by the bytes, so the file is named by them too
      const format = sniffFormat(baseData) ?? detectFormat(targetFile.name);
      const result = write(baseData, parseResult);
      if (!result.ok) throw new Error(result.error.type);
      if (result.warning) {
        setNotice(describeWarning(result.warning, t.outputTab));
      }
      const blob = new Blob([result.value.slice()], {
        type: getMimeType(format),
      });
      downloadBlob(
        blob,
        generateFilename(targetFile.name, format, '_embedded'),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }, [targetFile, parseResult, t]);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t.copyTab.description}
      </Text>

      {/* Target image: a click-to-pick card laid out like the main preview */}
      <Input.Wrapper label={t.copyTab.targetImage}>
        <FileButton
          onChange={(file) => {
            setTargetFile(file);
            setError(null);
          }}
          accept="image/png,image/jpeg,image/webp"
        >
          {(props) => (
            <Paper
              {...props}
              component="button"
              type="button"
              withBorder
              p="md"
              radius="md"
              bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))"
              style={{
                display: 'block',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'inherit',
                font: 'inherit',
              }}
            >
              {targetFile && targetPreviewUrl ? (
                <Group wrap="nowrap" gap="lg" align="center">
                  <Image
                    src={targetPreviewUrl}
                    alt={targetFile.name}
                    maw={150}
                    mah={150}
                    radius="md"
                    fit="cover"
                    style={{ flexShrink: 0 }}
                  />
                  <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={500} truncate="end" title={targetFile.name}>
                      {targetFile.name}
                    </Text>
                    <Group justify="space-between" align="center">
                      <Badge
                        variant="light"
                        size="lg"
                        style={{ textTransform: 'none' }}
                      >
                        {getFormatLabel(detectFormat(targetFile.name))}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {t.copyTab.changeHint}
                      </Text>
                    </Group>
                  </Stack>
                </Group>
              ) : (
                <Stack align="center" gap="md" py="xl">
                  <ImageUp size={48} />
                  <Text c="dimmed">{t.outputTab.selectImage}</Text>
                </Stack>
              )}
            </Paper>
          )}
        </FileButton>
      </Input.Wrapper>

      <Button
        color="green"
        fullWidth
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
      {notice && (
        <Text c="yellow" size="sm">
          {notice}
        </Text>
      )}
    </Stack>
  );
}
