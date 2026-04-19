import { Paper } from '@mantine/core';
import type { ReactNode } from 'react';

interface ContentPanelProps {
  children: ReactNode;
}

/**
 * Panel container for tab content sections with subtle background
 */
export function ContentPanel({ children }: ContentPanelProps) {
  return (
    <Paper
      p="md"
      radius="sm"
      bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))"
    >
      {children}
    </Paper>
  );
}
