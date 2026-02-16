import { Paper } from '@mantine/core';
import type { ComponentChildren } from 'preact';

interface ContentPanelProps {
  children: ComponentChildren;
}

/**
 * Dark panel container for tab content sections
 */
export function ContentPanel({ children }: ContentPanelProps) {
  return (
    <Paper p="md" radius="sm" bg="var(--mantine-color-dark-8)">
      {children}
    </Paper>
  );
}
