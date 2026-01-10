import { useEffect, useState } from 'preact/hooks';
import { read } from 'sd-metadata';
import type { ParseResult } from 'sd-metadata';
import styles from './App.module.css';
import { DropZone } from './components/DropZone/DropZone';
import { GitHubCorner } from './components/GitHubCorner/GitHubCorner';
import { Results } from './components/Results/Results';
import { ScrollToTop } from './components/ScrollToTop/ScrollToTop';
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

  const getSoftwareLabelForDisplay = (): string | null => {
    if (!state.parseResult) return null;
    if (state.parseResult.status === 'success') {
      return getSoftwareLabel(state.parseResult.metadata.software || 'Unknown');
    }
    return 'Unknown';
  };

  const getErrorMessage = (): string | undefined => {
    if (!state.parseResult) return undefined;
    switch (state.parseResult.status) {
      case 'empty':
        return 'empty';
      case 'unrecognized':
        return 'unrecognized';
      default:
        return undefined;
    }
  };

  return (
    <>
      <GitHubCorner url={GITHUB_URL} />
      <header class={styles.header}>
        <h1 class={styles.title}>sd-metadata</h1>
        <p class={styles.description}>
          Extract metadata from AI-generated images
        </p>
      </header>

      <main>
        <DropZone
          onFileSelect={handleFileSelect}
          previewUrl={state.previewUrl}
          filename={state.filename}
          softwareLabel={getSoftwareLabelForDisplay()}
          error={getErrorMessage()}
          globalDragOver={globalDragOver}
        />

        {state.parseResult && <Results parseResult={state.parseResult} />}
      </main>

      <footer class={styles.footer}>
        <p>
          Powered by{' '}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            sd-metadata
          </a>
        </p>
      </footer>
      <ScrollToTop />
    </>
  );
}
