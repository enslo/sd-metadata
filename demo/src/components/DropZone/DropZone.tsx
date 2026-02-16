import { Badge, Group, Image, Stack, Text } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { useStore } from '@nanostores/preact';
import { Upload } from 'lucide-preact';
import { $t } from '../../i18n';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  previewUrl: string | null;
  filename: string | null;
  softwareInfo: {
    label: string;
    status: 'success' | 'empty' | 'unrecognized' | 'invalid';
  } | null;
  globalDragOver?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'indigo',
  empty: 'gray',
  unrecognized: 'yellow',
  invalid: 'red',
};

/**
 * File drop zone with image preview
 */
export function DropZone({
  onFileSelect,
  previewUrl,
  filename,
  softwareInfo,
  globalDragOver,
}: DropZoneProps) {
  const t = useStore($t);

  const handleDrop = (files: File[]) => {
    const file = files[0];
    if (file) onFileSelect(file);
  };

  const hasPreview = previewUrl !== null;
  const badgeColor = STATUS_COLORS[softwareInfo?.status ?? ''] ?? 'indigo';

  return (
    <Dropzone
      onDrop={handleDrop}
      accept={IMAGE_MIME_TYPE}
      multiple={false}
      aria-label={t.dropzone.uploadLabel}
      styles={{
        root: {
          transition: 'all 200ms ease',
          ...(globalDragOver
            ? {
                transform: 'scale(1.02)',
                borderColor: 'var(--mantine-color-indigo-5)',
                backgroundColor: 'var(--mantine-color-indigo-light)',
              }
            : {}),
        },
      }}
    >
      {hasPreview ? (
        <Group wrap="nowrap" gap="lg" align="center">
          <Image
            src={previewUrl}
            alt={t.dropzone.preview}
            maw={150}
            mah={150}
            radius="md"
            fit="cover"
            style={{ flexShrink: 0 }}
          />
          <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <Text fw={500} truncate="end" title={filename ?? ''}>
              {filename}
            </Text>
            <Group justify="space-between" align="center">
              <Badge color={badgeColor} variant="filled" size="md">
                {softwareInfo?.label || t.dropzone.unknown}
              </Badge>
              <Text size="xs" c="dimmed">
                {t.dropzone.changeHint}
              </Text>
            </Group>
          </Stack>
        </Group>
      ) : (
        <Stack
          align="center"
          gap="md"
          py="xl"
          style={{ pointerEvents: 'none' }}
        >
          <Dropzone.Idle>
            <Upload size={48} />
          </Dropzone.Idle>
          <Text c="dimmed">{t.dropzone.placeholder}</Text>
        </Stack>
      )}
    </Dropzone>
  );
}
