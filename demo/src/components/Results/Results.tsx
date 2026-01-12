import type { ParseResult } from '@enslo/sd-metadata';
import { useEffect, useState } from 'preact/hooks';
import { ParsedMetadata } from './ParsedMetadata';
import { ExifSegments, RawChunks } from './RawData';
import styles from './Results.module.css';

interface ResultsProps {
  parseResult: ParseResult;
}

type TabName = 'parsed' | 'raw';

/**
 * Results section with parsed and raw tabs
 */
export function Results({ parseResult }: ResultsProps) {
  const [activeTab, setActiveTab] = useState<TabName>('parsed');
  const [resetKey, setResetKey] = useState(0);

  // Reset to parsed tab when parseResult changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on data change
  useEffect(() => {
    setActiveTab('parsed');
    setResetKey((k) => k + 1);
  }, [parseResult]);

  // Handle invalid status
  if (parseResult.status === 'invalid') {
    return (
      <div class={`${styles.error} fade-in`}>
        <p class={styles.errorMessage}>
          {parseResult.message ?? 'Invalid image file'}
        </p>
      </div>
    );
  }

  return (
    <div class={`${styles.results} fade-in`}>
      <div class={styles.tabs}>
        <button
          type="button"
          class={`${styles.tab} ${activeTab === 'parsed' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('parsed')}
        >
          Parsed Metadata
        </button>
        <button
          type="button"
          class={`${styles.tab} ${activeTab === 'raw' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          Raw Data
        </button>
      </div>

      <div class={styles.tabContent}>
        {activeTab === 'parsed' ? (
          <ParsedTabContent parseResult={parseResult} />
        ) : (
          <RawTabContent parseResult={parseResult} key={resetKey} />
        )}
      </div>
    </div>
  );
}

function ParsedTabContent({
  parseResult,
}: {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
}) {
  if (parseResult.status === 'empty') {
    return <ErrorMessage message="No metadata found in this image" />;
  }

  if (parseResult.status === 'unrecognized') {
    return (
      <ErrorMessage message="Metadata found but format not recognized. Check Raw Data tab." />
    );
  }

  return <ParsedMetadata metadata={parseResult.metadata} />;
}

function RawTabContent({
  parseResult,
}: {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
}) {
  if (parseResult.status === 'empty') {
    return <ErrorMessage message="No raw data available" />;
  }

  if (parseResult.raw.format === 'png') {
    return <RawChunks chunks={parseResult.raw.chunks} />;
  }

  return <ExifSegments segments={parseResult.raw.segments} />;
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div class={styles.metadataSection}>
      <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
        {message}
      </p>
    </div>
  );
}
