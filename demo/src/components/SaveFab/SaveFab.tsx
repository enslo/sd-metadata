import type { ParseResult } from '@enslo/sd-metadata';
import { ActionIcon, Affix, Group, Menu, Switch, Text } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { ChevronUp, Download } from 'lucide-preact';
import { useCallback, useState } from 'preact/hooks';
import { $t } from '../../i18n';
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

  const sourceFormat = detectFormat(filename);

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

  return (
    <Affix position={{ bottom: 80, right: 32 }}>
      <Menu
        opened={menuOpen}
        onChange={setMenuOpen}
        position="top-end"
        shadow="lg"
      >
        <Menu.Target>
          <ActionIcon
            size={48}
            radius="xl"
            color={processing ? 'indigo' : 'green'}
            variant="filled"
            loading={processing}
            onClick={() => !processing && setMenuOpen((prev) => !prev)}
            aria-label={t.saveFab.buttonLabel}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
          >
            {menuOpen ? <ChevronUp size={24} /> : <Download size={24} />}
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>
            {getFormatLabel(sourceFormat)} {t.saveFab.to}
          </Menu.Label>
          <Menu.Divider />
          {OUTPUT_FORMATS.map((format) => (
            <Menu.Item
              key={format}
              onClick={() => handleSave(format)}
              disabled={processing}
            >
              {getFormatLabel(format)}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            closeMenuOnClick={false}
            component="div"
            style={{ cursor: 'default' }}
          >
            <Group justify="space-between">
              <Text size="sm">{t.saveFab.keepMetadata}</Text>
              <Switch
                checked={keepMetadata}
                onChange={(e: { currentTarget: { checked: boolean } }) =>
                  setKeepMetadata(e.currentTarget.checked)
                }
                size="sm"
                aria-label={t.saveFab.keepMetadata}
              />
            </Group>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Affix>
  );
}
