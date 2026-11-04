import type { ParseResult } from '@enslo/sd-metadata';
import { write } from '@enslo/sd-metadata';
import {
  Button,
  FileButton,
  Group,
  Image,
  Input,
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

interface CopyToImageTabProps {
  parseResult: ParseResult;
}

/**
 * Copy tab: write the loaded image's metadata, as it is, into another
 * uploaded image. The target keeps its pixels and format; only its
 * metadata is replaced. Editing happens in the Output tab, on the copy.
 */
export function CopyToImageTab({ parseResult }: CopyToImageTabProps) {
  const t = useStore($t);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-initialize when a new image is loaded
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on parseResult change
  useEffect(() => {
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
      const result = write(baseData, parseResult);
      if (!result.ok) throw new Error(result.error.type);
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
  }, [targetFile, parseResult]);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t.copyTab.description}
      </Text>

      {/* Target image + save */}
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
        <Button
          color="green"
          onClick={handleSave}
          loading={processing}
          disabled={!targetFile}
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
