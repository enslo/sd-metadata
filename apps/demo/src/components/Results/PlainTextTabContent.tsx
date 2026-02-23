import type { ParseResult } from '@enslo/sd-metadata';
import { stringify } from '@enslo/sd-metadata';
import type { I18nMessages } from '../../i18n';
import { ContentPanel } from '../ContentPanel';
import { ErrorMessage } from './ErrorMessage';

interface PlainTextTabContentProps {
  parseResult: Exclude<ParseResult, { status: 'invalid' }>;
  t: I18nMessages;
}

/**
 * @package
 * Tab content for the plain text (stringify) view
 */
export function PlainTextTabContent({
  parseResult,
  t,
}: PlainTextTabContentProps) {
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
