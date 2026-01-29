import { read } from '@enslo/sd-metadata';
import type { ParseResult } from '@enslo/sd-metadata';
import { useStore } from '@nanostores/preact';
import { useEffect, useState } from 'preact/hooks';
import styles from './App.module.css';
import { DropZone } from './components/DropZone/DropZone';
import { GitHubCorner } from './components/GitHubCorner/GitHubCorner';
import { LanguageSwitcher } from './components/LanguageSwitcher/LanguageSwitcher';
import { Results } from './components/Results/Results';
import { SaveFab } from './components/SaveFab';
import { ScrollToTop } from './components/ScrollToTop/ScrollToTop';
import { $t } from './i18n';
import { getSoftwareLabel } from './utils';

const GITHUB_URL = 'https://github.com/enslo/sd-metadata';

interface AppState {
  parseResult: ParseResult | null;
  filename: string | null;
  previewUrl: string | null;
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
  });
  const [globalDragOver, setGlobalDragOver] = useState(false);

  const handleFileSelect = async (file: File) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    // Read and parse metadata
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const parseResult = read(data);

    setState({
      parseResult,
      filename: file.name,
      previewUrl,
    });
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
        // Inline file handling to avoid dependency issues
        const url = URL.createObjectURL(file);
        file.arrayBuffer().then((buffer) => {
          const data = new Uint8Array(buffer);
          const result = read(data);
          setState({
            parseResult: result,
            filename: file.name,
            previewUrl: url,
          });
        });
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
    if (!state.parseResult) return null;
    if (state.parseResult.status === 'success') {
      return {
        label: getSoftwareLabel(
          state.parseResult.metadata.software || 'Unknown',
        ),
        status: 'success',
      };
    }
    if (state.parseResult.status === 'empty') {
      return { label: 'Empty', status: 'empty' };
    }
    if (state.parseResult.status === 'unrecognized') {
      return { label: 'Unrecognized', status: 'unrecognized' };
    }
    // invalid or unsupportedFormat
    return { label: 'Invalid', status: 'invalid' };
  };

  return (
    <>
      <LanguageSwitcher />
      <GitHubCorner url={GITHUB_URL} />
      <header class={styles.header}>
        <h1 class={styles.title}>sd-metadata</h1>
        <p class={styles.description}>{t.app.description}</p>
      </header>

      <main>
        <DropZone
          onFileSelect={handleFileSelect}
          previewUrl={state.previewUrl}
          filename={state.filename}
          softwareInfo={getSoftwareLabelForDisplay()}
          globalDragOver={globalDragOver}
        />

        {state.parseResult && <Results parseResult={state.parseResult} />}
      </main>

      <footer class={styles.footer}>
        <p>
          Powered by{' '}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            @enslo/sd-metadata
          </a>
        </p>
      </footer>
      {state.parseResult && state.previewUrl && state.filename && (
        <SaveFab
          previewUrl={state.previewUrl}
          parseResult={state.parseResult}
          filename={state.filename}
        />
      )}
      <ScrollToTop />
    </>
  );
}
