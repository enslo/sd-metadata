import { Button, Tooltip } from '@mantine/core';
import { useMantineColorScheme } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { Moon, Sun } from 'lucide-preact';
import { $t } from '../../i18n';

/**
 * Theme toggle button for switching between light and dark modes
 */
export function ThemeToggle() {
  const t = useStore($t);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tooltip
      label={isDark ? t.themeToggle.switchToLight : t.themeToggle.switchToDark}
    >
      <Button
        variant="subtle"
        size="xs"
        onClick={toggleColorScheme}
        aria-label={t.themeToggle.ariaLabel}
      >
        {isDark ? <Sun size={24} /> : <Moon size={24} />}
      </Button>
    </Tooltip>
  );
}
