import type { VendorInfo } from '@enslo/sd-metadata';
import { productLabel, vendorLabels } from '@enslo/sd-metadata';
import { Table, Text } from '@mantine/core';
import type { I18nMessages } from '../../i18n';
import { ParsedSection } from './ParsedSection';

interface VendorSectionProps {
  info: VendorInfo;
  t: I18nMessages;
}

/**
 * @package
 * Vendor view: no generation parameters, just the declared (unverified)
 * vendor, its AI service and where the declaration was found.
 */
export function VendorSection({ info, t }: VendorSectionProps) {
  const rows = [
    { label: t.results.vendor.vendor, value: vendorLabels[info.vendor] },
    { label: t.results.vendor.product, value: productLabel(info) },
    info.product
      ? { label: t.results.vendor.declaredProduct, value: info.product }
      : null,
    {
      label: t.results.vendor.source,
      value: t.results.vendor.sources[info.source],
    },
  ].filter((r): r is { label: string; value: string } => r !== null);

  return (
    <ParsedSection title={t.results.vendor.title}>
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
