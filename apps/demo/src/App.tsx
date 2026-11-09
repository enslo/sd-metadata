import { originLabel, parse, parseVideo } from '@enslo/sd-metadata';
import {
  Anchor,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DropZone } from './components/DropZone';
import { GitHubCorner } from './components/GitHubCorner';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { Results } from './components/Results';
import { ScrollToTop } from './components/ScrollToTop';
import { ThemeToggle } from './components/ThemeToggle';
import { $t } from './i18n';
import { isVideoFile, type LoadedResult } from './lib/media';

declare const __CORE_VERSION__: string;

const GITHUB_URL = 'https://github.com/enslo/sd-metadata';

interface AppState {
  loaded: LoadedResult | null;
  filename: string | null;
  previewUrl: string | null;
}

/**
 * Main application component
 */
export function App() {
  const t = useStore($t);
  const [state, setState] = useState<AppState>({
    loaded: null,
    filename: null,
    previewUrl: null,
  });
  // Held in a ref rather than state so large binary payloads do not flow
  // through React's reconciliation (React 19.2 dev mode otherwise serializes
  // them on every commit for performance timeline logging).
  const fileDataRef = useRef<Uint8Array | null>(null);
  // The blob URL of the shown preview, revoked when the next one replaces it
  const previewUrlRef = useRef<string | null>(null);
  // Counts the files handed in; a result whose count is no longer the
  // latest arrived after a later drop and is thrown away
  const generationRef = useRef(0);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    const generation = ++generationRef.current;
    const previewUrl = URL.createObjectURL(file);
    setLoading(true);
    try {
      let loaded: LoadedResult;
      let data: Uint8Array | null = null;
      if (isVideoFile(file)) {
        // The File goes in as it is: parseVideo() reads only the byte
        // ranges that hold metadata, never the whole video.
        loaded = { media: 'video', parseResult: await parseVideo(file) };
      } else {
        data = new Uint8Array(await file.arrayBuffer());
        loaded = { media: 'image', parseResult: await parse(data) };
      }

      if (generation !== generationRef.current) {
        // A later file was dropped while this one was being read
        URL.revokeObjectURL(previewUrl);
        return;
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = previewUrl;
      fileDataRef.current = data;
      setState({ loaded, filename: file.name, previewUrl });
    } catch (e) {
      URL.revokeObjectURL(previewUrl);
      console.error('Failed to load file:', e);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

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
      // A drop on the Dropzone is handled by its own onDrop; the native
      // event still bubbles here and would read the file a second time
      if (dropzoneRef.current?.contains(e.target as Node)) return;
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
  }, [handleFileSelect]);

  const getSoftwareLabelForDisplay = (): {
    label: string;
    status: 'success' | 'vendor' | 'empty' | 'unrecognized' | 'invalid';
    stealth?: boolean;
  } | null => {
    const result = state.loaded?.parseResult;
    switch (result?.status) {
      case 'success':
        return {
          label: originLabel(result),
          status: 'success',
          stealth: 'stealth' in result && result.stealth === true,
        };
      case 'vendor':
        return { label: originLabel(result), status: 'vendor' };
      case 'empty':
        return { label: 'Empty', status: 'empty' };
      case 'unrecognized':
        return {
          label: 'Unrecognized',
          status: 'unrecognized',
          stealth: 'stealth' in result && result.stealth === true,
        };
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
          <div ref={dropzoneRef}>
            <DropZone
              onFileSelect={handleFileSelect}
              previewUrl={state.previewUrl}
              media={state.loaded?.media ?? null}
              filename={state.filename}
              softwareInfo={getSoftwareLabelForDisplay()}
              globalDragOver={globalDragOver}
              loading={loading}
            />
          </div>

          {state.loaded && state.filename && state.previewUrl && (
            <Results
              loaded={state.loaded}
              fileDataRef={fileDataRef}
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
