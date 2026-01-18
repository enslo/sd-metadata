import { useStore } from '@nanostores/preact';
import { Upload } from 'lucide-preact';
import { useRef, useState } from 'preact/hooks';
import { $t } from '../../i18n';
import styles from './DropZone.module.css';

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

/**
 * File drop zone with image preview
 */
export function DropZone({
  onFileSelect,
  previewUrl,
  filename,
  softwareInfo,
  globalDragOver = false,
}: DropZoneProps) {
  const t = useStore($t);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => inputRef.current?.click();

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    if (e.relatedTarget === null) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (file) onFileSelect(file);
  };

  const handleChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) onFileSelect(file);
  };

  const hasPreview = previewUrl !== null;
  const isDragOver = dragOver || globalDragOver;

  const dropZoneClass = [
    styles.dropZone,
    isDragOver && styles.dragOver,
    hasPreview && styles.hasPreview,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      class={dropZoneClass}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0}
      // biome-ignore lint/a11y/useSemanticElements: drop zone needs large clickable area
      role="button"
      aria-label={t.dropzone.uploadLabel}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={handleChange}
      />

      {hasPreview ? (
        <div class={styles.preview}>
          <img src={previewUrl} alt={t.dropzone.preview} />
          <div class={styles.previewRight}>
            <div class={styles.imageInfo}>
              <h3 class={styles.filename} title={filename ?? ''}>
                {filename}
              </h3>
            </div>
            <div class={styles.infoRow}>
              <span
                class={`${styles.softwareBadge} ${
                  softwareInfo?.status === 'empty'
                    ? styles.badgeEmpty
                    : softwareInfo?.status === 'unrecognized'
                      ? styles.badgeUnrecognized
                      : softwareInfo?.status === 'invalid'
                        ? styles.badgeInvalid
                        : ''
                }`}
              >
                {softwareInfo?.label || t.dropzone.unknown}
              </span>
              <span class={styles.changeHint}>{t.dropzone.changeHint}</span>
            </div>
          </div>
        </div>
      ) : (
        <div class={styles.content}>
          <Upload size={48} aria-hidden="true" />
          <p>{t.dropzone.placeholder}</p>
        </div>
      )}
    </div>
  );
}
