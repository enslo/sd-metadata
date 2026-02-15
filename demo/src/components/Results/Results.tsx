import type { ParseResult } from '@enslo/sd-metadata';
import { stringify } from '@enslo/sd-metadata';
import { useStore } from '@nanostores/preact';
import { useEffect, useState } from 'preact/hooks';
import { $t } from '../../i18n';
import { CopyButton } from '../CopyButton/CopyButton';
import { ParsedMetadata } from './ParsedMetadata';
import { ExifSegments, RawChunks } from './RawData';
import styles from './Results.module.css';

interface ResultsProps {
  parseResult: ParseResult;
}

type TabName = 'parsed' | 'plaintext' | 'raw';

/**
 * Results section with parsed and raw tabs
 */
export function Results({ parseResult }: ResultsProps) {
  const t = useStore($t);
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
          {parseResult.message ?? t.results.errors.invalid}
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
          {t.results.tabs.parsed}
        </button>
        <button
          type="button"
          class={`${styles.tab} ${activeTab === 'plaintext' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('plaintext')}
        >
          {t.results.tabs.plaintext}
        </button>
        <button
          type="button"
          class={`${styles.tab} ${activeTab === 'raw' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          {t.results.tabs.raw}
        </button>
      </div>

      <div class={styles.tabContent}>
        {activeTab === 'parsed' ? (
          <ParsedTabContent parseResult={parseResult} t={t} />
        ) : activeTab === 'plaintext' ? (
          <PlainTextTabContent parseResult={parseResult} t={t} />
        ) : (
          <RawTabContent parseResult={parseResult} t={t} key={resetKey} />
        )}
      </div>
    </div>
  );
}

function ParsedTabContent({
  parseResult,
  t,
}: {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
  t: ReturnType<typeof useStore<typeof $t>>;
}) {
  if (parseResult.status === 'empty') {
    return <ErrorMessage message={t.results.errors.noMetadata} />;
  }

  if (parseResult.status === 'unrecognized') {
    return <ErrorMessage message={t.results.errors.unrecognized} />;
  }

  return <ParsedMetadata metadata={parseResult.metadata} />;
}

function RawTabContent({
  parseResult,
  t,
}: {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
  t: ReturnType<typeof useStore<typeof $t>>;
}) {
  if (parseResult.status === 'empty') {
    return <ErrorMessage message={t.results.errors.noRawData} />;
  }

  if (parseResult.raw.format === 'png') {
    return <RawChunks chunks={parseResult.raw.chunks} />;
  }

  return <ExifSegments segments={parseResult.raw.segments} />;
}

function PlainTextTabContent({
  parseResult,
  t,
}: {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
  t: ReturnType<typeof useStore<typeof $t>>;
}) {
  const text = stringify(parseResult);

  if (!text) {
    return <ErrorMessage message={t.results.errors.noPlainText} />;
  }

  return (
    <div class={styles.metadataSection}>
      <div class={styles.sectionHeader}>
        <h4 class={styles.sectionTitle}>{t.results.tabs.plaintext}</h4>
        <CopyButton value={text} />
      </div>
      <pre class={styles.plainText}>{text}</pre>
    </div>
  );
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
