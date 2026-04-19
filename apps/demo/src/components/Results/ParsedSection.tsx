import { Group, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { ContentPanel } from '../ContentPanel';
import { CopyButton } from '../CopyButton';

interface ParsedSectionProps {
  title: string;
  copyValue?: string;
  children: ReactNode;
}

/**
 * @package
 * Labeled panel section with optional copy button for the parsed metadata view
 */
export function ParsedSection({
  title,
  copyValue,
  children,
}: ParsedSectionProps) {
  return (
    <ContentPanel>
      <Group justify="space-between" mb="xs">
        <Text
          size="xs"
          fw={700}
          c="dimmed"
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {title}
        </Text>
        {copyValue !== undefined && <CopyButton value={copyValue} />}
      </Group>
      {children}
    </ContentPanel>
  );
}
