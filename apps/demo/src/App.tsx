import type { ParseResult } from '@enslo/sd-metadata';
import { read, softwareLabels } from '@enslo/sd-metadata';
import {
  Anchor,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { useEffect, useState } from 'preact/hooks';
import { DropZone } from './components/DropZone';
import { GitHubCorner } from './components/GitHubCorner';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { Results } from './components/Results';
import { ScrollToTop } from './components/ScrollToTop';
import { ThemeToggle } from './components/ThemeToggle';
import { $t } from './i18n';

declare const __CORE_VERSION__: string;

const GITHUB_URL = 'https://github.com/enslo/sd-metadata';

interface AppState {
  parseResult: ParseResult | null;
  filename: string | null;
  previewUrl: string | null;
  fileData: Uint8Array | null;
}

/**
 * Main application component
 */
export function App() {
  const t = useStore($t);
  const [state, setState] = useState<AppState>({
    parseResult: null,
    filename: null,
    previewUrl: null,
    fileData: null,
  });
  const [globalDragOver, setGlobalDragOver] = useState(false);

  const handleFileSelect = async (file: File) => {
    try {
      const previewUrl = URL.createObjectURL(file);
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const parseResult = read(data);

      setState({
        parseResult,
        filename: file.name,
        previewUrl,
        fileData: data,
      });
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  };

  // Enable drop anywhere on the page
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setGlobalDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setGlobalDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setGlobalDragOver(false);
      const file = e.dataTransfer?.files[0];
      if (file) {
        void handleFileSelect(file);
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  const getSoftwareLabelForDisplay = (): {
    label: string;
    status: 'success' | 'empty' | 'unrecognized' | 'invalid';
  } | null => {
    switch (state.parseResult?.status) {
      case 'success':
        return {
          label:
            softwareLabels[state.parseResult.metadata.software] ?? 'Unknown',
          status: 'success',
        };
      case 'empty':
        return { label: 'Empty', status: 'empty' };
      case 'unrecognized':
        return { label: 'Unrecognized', status: 'unrecognized' };
      case 'invalid':
        return { label: 'Invalid', status: 'invalid' };
      default:
        return null;
    }
  };

  return (
    <Container size={1000} py="xl">
      <Group
        gap={0}
        className="toolbar-fixed"
        bg="var(--mantine-color-body)"
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 100,
          borderRadius: 'var(--mantine-radius-md)',
        }}
      >
        <LanguageSwitcher />
        <ThemeToggle />
      </Group>
      <GitHubCorner url={GITHUB_URL} />

      <Stack gap="lg">
        <Stack component="header" gap={0} align="center">
          <Title
            order={1}
            c="indigo"
            style={{ fontSize: '2rem', lineHeight: 1.2 }}
          >
            sd-metadata
          </Title>
          <Text c="dimmed">{t.app.description}</Text>
        </Stack>

        <Stack component="main" gap="md">
          <DropZone
            onFileSelect={handleFileSelect}
            previewUrl={state.previewUrl}
            filename={state.filename}
            softwareInfo={getSoftwareLabelForDisplay()}
            globalDragOver={globalDragOver}
          />

          {state.parseResult &&
            state.fileData &&
            state.filename &&
            state.previewUrl && (
              <Results
                parseResult={state.parseResult}
                fileData={state.fileData}
                filename={state.filename}
                previewUrl={state.previewUrl}
              />
            )}
        </Stack>

        <Divider />
        <Stack component="footer" gap="xs" align="center">
          <Text size="sm" c="dimmed">
            Powered by{' '}
            <Anchor href={GITHUB_URL} target="_blank" rel="noreferrer">
              @enslo/sd-metadata
            </Anchor>{' '}
            <Text component="span" size="xs" c="dimmed" opacity={0.6}>
              {__CORE_VERSION__}
            </Text>
          </Text>
          <Text size="xs" c="dimmed">
            <Anchor href="https://sd-metadata-lite.pages.dev/" size="xs">
              {t.app.liteVersion}
            </Anchor>
          </Text>
        </Stack>
      </Stack>

      <ScrollToTop />
    </Container>
  );
}
