import type { C2paMetadata } from '@enslo/sd-metadata';
import { c2paVendorLabels } from '@enslo/sd-metadata';
import { Table, Text } from '@mantine/core';
import type { I18nMessages } from '../../i18n';
import { ParsedSection } from './ParsedSection';

interface C2paSectionProps {
  c2pa: C2paMetadata;
  t: I18nMessages;
}

/**
 * @package
 * Content Credentials (C2PA) view: no generation parameters, just the declared
 * (unverified) vendor and manifest details.
 */
export function C2paSection({ c2pa, t }: C2paSectionProps) {
  const rows = [
    { label: t.results.c2pa.vendor, value: c2paVendorLabels[c2pa.vendor] },
    {
      label: t.results.c2pa.aiGenerated,
      value: c2pa.aiGenerated ? t.results.c2pa.yes : t.results.c2pa.no,
    },
    c2pa.claimGenerator
      ? { label: t.results.c2pa.claimGenerator, value: c2pa.claimGenerator }
      : null,
    c2pa.digitalSourceType
      ? {
          label: t.results.c2pa.digitalSourceType,
          value: c2pa.digitalSourceType,
        }
      : null,
  ].filter((r): r is { label: string; value: string } => r !== null);

  return (
    <ParsedSection title={t.results.c2pa.title}>
      <Table
        highlightOnHover
        horizontalSpacing={0}
        verticalSpacing="xs"
        layout="fixed"
      >
        <Table.Tbody>
          {rows.map(({ label, value }) => (
            <Table.Tr key={label}>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {label}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" fw={500} style={{ wordBreak: 'break-all' }}>
                  {value}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ParsedSection>
  );
}
