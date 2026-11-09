import {
  Badge,
  Box,
  Group,
  Image,
  LoadingOverlay,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  Dropzone,
  type FileRejection,
  IMAGE_MIME_TYPE,
} from '@mantine/dropzone';
import { useStore } from '@nanostores/react';
import { Upload } from 'lucide-react';
import { $t } from '../../i18n';
import { VIDEO_MIME_TYPES } from '../../lib/media';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  previewUrl: string | null;
  /** Kind of the loaded file, which decides the preview element */
  media: 'image' | 'video' | null;
  filename: string | null;
  softwareInfo: {
    label: string;
    status: 'success' | 'vendor' | 'empty' | 'unrecognized' | 'invalid';
    /** True when the result was recovered from pixel LSBs (Stealth PNGInfo) */
    stealth?: boolean;
  } | null;
  globalDragOver?: boolean;
  /** True while a dropped file is being read and parsed */
  loading?: boolean;
}

/** Images by MIME type, plus the video containers parseVideo() reads */
const ACCEPT: Record<string, string[]> = {
  ...Object.fromEntries(IMAGE_MIME_TYPE.map((type) => [type, []])),
  ...VIDEO_MIME_TYPES,
};

const STATUS_COLORS: Record<string, string> = {
  success: 'indigo',
  vendor: 'grape',
  empty: 'gray',
  unrecognized: 'yellow',
  invalid: 'red',
};

/**
 * File drop zone with image or video preview
 */
export function DropZone({
  onFileSelect,
  previewUrl,
  media,
  filename,
  softwareInfo,
  globalDragOver,
  loading = false,
}: DropZoneProps) {
  const t = useStore($t);

  const handleDrop = (files: File[]) => {
    const file = files[0];
    if (file) onFileSelect(file);
  };

  // A file of another type is read all the same, so that it shows up as
  // invalid instead of being dropped without a word
  const handleReject = (rejections: FileRejection[]) => {
    const file = rejections[0]?.file;
    if (file) onFileSelect(file);
  };

  const hasPreview = previewUrl !== null;
  const badgeColor = STATUS_COLORS[softwareInfo?.status ?? ''] ?? 'indigo';

  return (
    <Box pos="relative">
      {/* Drops go through the overlay: a file dropped while another is
          being read replaces it, as the drop handler keeps the latest */}
      <LoadingOverlay
        visible={loading}
        zIndex={1}
        overlayProps={{ radius: 'md', blur: 1 }}
        loaderProps={{ size: 'sm' }}
        style={{ pointerEvents: 'none' }}
      />
      <Dropzone
        onDrop={handleDrop}
        onReject={handleReject}
        accept={ACCEPT}
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
            {media === 'video' ? (
              <video
                src={previewUrl}
                aria-label={t.dropzone.preview}
                muted
                loop
                autoPlay
                playsInline
                style={{
                  maxWidth: 150,
                  maxHeight: 150,
                  borderRadius: 'var(--mantine-radius-md)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <Image
                src={previewUrl}
                alt={t.dropzone.preview}
                maw={150}
                mah={150}
                radius="md"
                fit="cover"
                style={{ flexShrink: 0 }}
              />
            )}
            <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
              <Text fw={500} truncate="end" title={filename ?? ''}>
                {filename}
              </Text>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Badge
                    color={badgeColor}
                    variant="filled"
                    size="lg"
                    style={{ textTransform: 'none' }}
                  >
                    {softwareInfo?.label || t.dropzone.unknown}
                  </Badge>
                  {softwareInfo?.stealth && (
                    <Tooltip
                      label={t.dropzone.stealthTooltip}
                      multiline
                      w={300}
                      withArrow
                    >
                      <Badge
                        color="grape"
                        variant="light"
                        size="lg"
                        style={{
                          textTransform: 'none',
                          cursor: 'help',
                          // Dropzone disables pointer events on its inner
                          // content; re-enable them so the tooltip opens.
                          pointerEvents: 'auto',
                        }}
                      >
                        {t.dropzone.stealthBadge}
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
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
    </Box>
  );
}
