import type { ParseResult } from '@enslo/sd-metadata';
import { stringify } from '@enslo/sd-metadata';
import { Alert, Paper, Tabs, Text } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { useEffect, useState } from 'preact/hooks';
import { $t } from '../../i18n';
import { EmbedEditor } from '../EmbedEditor';
import { ContentPanel } from './ContentPanel';
import { ParsedMetadata } from './ParsedMetadata';
import { ExifSegments, RawChunks } from './RawData';

interface ResultsProps {
  parseResult: ParseResult;
  fileData: Uint8Array;
  filename: string;
}

/**
 * Results section with parsed, plaintext, raw, and embed tabs
 */
export function Results({ parseResult, fileData, filename }: ResultsProps) {
  const t = useStore($t);
  const [activeTab, setActiveTab] = useState<string | null>('parsed');
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
      <Alert color="red" variant="light" className="fade-in">
        {parseResult.message ?? t.results.errors.invalid}
      </Alert>
    );
  }

  return (
    <Paper className="fade-in" mt="md">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="parsed">{t.results.tabs.parsed}</Tabs.Tab>
          <Tabs.Tab value="plaintext">{t.results.tabs.plaintext}</Tabs.Tab>
          <Tabs.Tab value="raw">{t.results.tabs.raw}</Tabs.Tab>
          <Tabs.Tab value="embed">{t.results.tabs.embed}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="parsed" pt="md">
          <ParsedTabContent parseResult={parseResult} t={t} />
        </Tabs.Panel>

        <Tabs.Panel value="plaintext" pt="md">
          <PlainTextTabContent parseResult={parseResult} t={t} />
        </Tabs.Panel>

        <Tabs.Panel value="raw" pt="md">
          <RawTabContent parseResult={parseResult} t={t} key={resetKey} />
        </Tabs.Panel>

        <Tabs.Panel value="embed" pt="md">
          <EmbedEditor
            parseResult={parseResult}
            fileData={fileData}
            filename={filename}
          />
        </Tabs.Panel>
      </Tabs>
    </Paper>
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
    <ContentPanel>
      <pre
        style={{
          fontFamily: 'var(--mantine-font-family-monospace)',
          fontSize: '0.85rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {text}
      </pre>
    </ContentPanel>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <Text c="dimmed" ta="center" py="xl">
      {message}
    </Text>
  );
}
