import { Alert, Paper, Stack, Tabs } from '@mantine/core';
import { useStore } from '@nanostores/react';
import { type RefObject, useEffect, useState } from 'react';
import { $t, type I18nMessages } from '../../i18n';
import type { LoadedResult } from '../../lib/media';
import { canKeepMetadata } from '../../lib/output';
import { CopyToImageTab } from '../CopyToImageTab';
import { OutputTab } from '../OutputTab';
import { ParsedTabContent } from './ParsedTabContent';
import { PlainTextTabContent } from './PlainTextTabContent';
import { RawTabContent } from './RawTabContent';

interface ResultsProps {
  loaded: LoadedResult;
  fileDataRef: RefObject<Uint8Array | null>;
  filename: string;
  previewUrl: string;
}

/**
 * Results section with parsed, plaintext, raw, output and copy tabs. Videos get
 * no output or copy tab: writing metadata into videos is not supported.
 */
export function Results({
  loaded,
  fileDataRef,
  filename,
  previewUrl,
}: ResultsProps) {
  const t: I18nMessages = useStore($t);
  const [activeTab, setActiveTab] = useState<string | null>('parsed');
  const { parseResult } = loaded;
  // Copy writes the loaded metadata as it is, so it needs metadata to write
  const canCopy =
    loaded.media === 'image' && canKeepMetadata(loaded.parseResult);

  // Reset to parsed tab when parseResult changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on parseResult change
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
            {loaded.media === 'image' && (
              <>
                <Tabs.Tab value="output">{t.results.tabs.output}</Tabs.Tab>
                {canCopy && (
                  <Tabs.Tab value="copy">{t.results.tabs.copy}</Tabs.Tab>
                )}
              </>
            )}
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

          {loaded.media === 'image' && (
            <Tabs.Panel value="output">
              <OutputTab
                parseResult={loaded.parseResult}
                fileDataRef={fileDataRef}
                filename={filename}
              />
            </Tabs.Panel>
          )}
          {canCopy && (
            <Tabs.Panel value="copy">
              <CopyToImageTab parseResult={loaded.parseResult} />
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>
    </Paper>
  );
}
