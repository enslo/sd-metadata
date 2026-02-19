import type { ParseResult } from '@enslo/sd-metadata';
import { Alert, Paper, Stack, Tabs } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { useEffect, useState } from 'preact/hooks';
import { $t, type I18nMessages } from '../../i18n';
import { EmbedEditor } from '../EmbedEditor';
import { SaveBar } from '../SaveBar';
import { ParsedTabContent } from './ParsedTabContent';
import { PlainTextTabContent } from './PlainTextTabContent';
import { RawTabContent } from './RawTabContent';

interface ResultsProps {
  parseResult: ParseResult;
  fileData: Uint8Array;
  filename: string;
  previewUrl: string;
}

/**
 * Results section with parsed, plaintext, raw, and embed tabs
 */
export function Results({
  parseResult,
  fileData,
  filename,
  previewUrl,
}: ResultsProps) {
  const t: I18nMessages = useStore($t);
  const [activeTab, setActiveTab] = useState<string | null>('parsed');

  // Reset to parsed tab when parseResult changes
  useEffect(() => setActiveTab('parsed'), [parseResult]);

  // Handle invalid status
  if (parseResult.status === 'invalid') {
    return (
      <Alert color="red" variant="light" className="fade-in">
        {parseResult.message ?? t.results.errors.invalid}
      </Alert>
    );
  }

  return (
    <Paper className="fade-in">
      <Stack gap="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="parsed">{t.results.tabs.parsed}</Tabs.Tab>
            <Tabs.Tab value="plaintext">{t.results.tabs.plaintext}</Tabs.Tab>
            <Tabs.Tab value="raw">{t.results.tabs.raw}</Tabs.Tab>
            <Tabs.Tab value="embed">{t.results.tabs.embed}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="parsed">
            <ParsedTabContent parseResult={parseResult} t={t} />
          </Tabs.Panel>

          <Tabs.Panel value="plaintext">
            <PlainTextTabContent parseResult={parseResult} t={t} />
          </Tabs.Panel>

          <Tabs.Panel value="raw">
            <RawTabContent parseResult={parseResult} t={t} key={previewUrl} />
          </Tabs.Panel>

          <Tabs.Panel value="embed">
            <EmbedEditor
              parseResult={parseResult}
              fileData={fileData}
              filename={filename}
            />
          </Tabs.Panel>
        </Tabs>

        {activeTab !== 'embed' && (
          <SaveBar
            parseResult={parseResult}
            previewUrl={previewUrl}
            filename={filename}
          />
        )}
      </Stack>
    </Paper>
  );
}
