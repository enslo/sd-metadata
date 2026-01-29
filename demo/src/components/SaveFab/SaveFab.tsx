import type { ParseResult } from '@enslo/sd-metadata';
import { useStore } from '@nanostores/preact';
import { ChevronUp, Download } from 'lucide-preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { $t } from '../../i18n';
import styles from './SaveFab.module.css';
import {
  type OutputFormat,
  convertAndDownload,
  detectFormat,
  getFormatLabel,
} from './utils';

interface SaveFabProps {
  previewUrl: string;
  parseResult: ParseResult;
  filename: string;
}

const OUTPUT_FORMATS: OutputFormat[] = ['png', 'jpeg', 'webp'];

/**
 * Floating action button for saving images with metadata
 */
export function SaveFab({ previewUrl, parseResult, filename }: SaveFabProps) {
  const t = useStore($t);
  const [menuOpen, setMenuOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [keepMetadata, setKeepMetadata] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sourceFormat = detectFormat(filename);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleSave = useCallback(
    async (targetFormat: OutputFormat) => {
      setMenuOpen(false);
      setProcessing(true);
      try {
        await convertAndDownload(
          previewUrl,
          parseResult,
          filename,
          targetFormat,
          keepMetadata,
        );
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setProcessing(false);
      }
    },
    [previewUrl, parseResult, filename, keepMetadata],
  );

  const toggleMenu = () => {
    if (!processing) {
      setMenuOpen((prev) => !prev);
    }
  };

  return (
    <div class={styles.container}>
      {menuOpen && (
        <div
          ref={menuRef}
          class={styles.menu}
          role="menu"
          aria-label={t.saveFab.menuLabel}
        >
          <div class={styles.menuHeader}>
            {getFormatLabel(sourceFormat)} {t.saveFab.to}
          </div>
          <div class={styles.menuDivider} />
          {OUTPUT_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              class={styles.menuItem}
              role="menuitem"
              onClick={() => handleSave(format)}
              disabled={processing}
            >
              {getFormatLabel(format)}
            </button>
          ))}
          <div class={styles.menuDivider} />
          <div class={styles.toggleRow}>
            <span class={styles.toggleLabel}>{t.saveFab.keepMetadata}</span>
            <button
              type="button"
              role="switch"
              aria-checked={keepMetadata}
              aria-label={t.saveFab.keepMetadata}
              class={`${styles.toggle} ${keepMetadata ? styles.toggleOn : ''}`}
              onClick={() => setKeepMetadata((prev) => !prev)}
            >
              <span class={styles.toggleKnob} />
            </button>
          </div>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        class={`${styles.fab} ${processing ? styles.processing : ''}`}
        onClick={toggleMenu}
        aria-label={t.saveFab.buttonLabel}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        disabled={processing}
      >
        {processing ? (
          <div class={styles.spinner} />
        ) : menuOpen ? (
          <ChevronUp size={24} />
        ) : (
          <Download size={24} />
        )}
      </button>
    </div>
  );
}
