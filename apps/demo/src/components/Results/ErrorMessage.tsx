import { Text } from '@mantine/core';

interface ErrorMessageProps {
  message: string;
}

/**
 * @package
 * Centered dimmed text for empty/error states in tab content
 */
export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <Text c="dimmed" ta="center" py="xl">
      {message}
    </Text>
  );
}
