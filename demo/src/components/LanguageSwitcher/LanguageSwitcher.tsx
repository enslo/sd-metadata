import { Button, Text, Tooltip } from '@mantine/core';
import { useStore } from '@nanostores/preact';
import { Languages } from 'lucide-preact';
import type { Locale } from '../../i18n';
import { $locale, $t, setLocale } from '../../i18n';

/**
 * Language switcher button component
 */
export function LanguageSwitcher() {
  const currentLocale = useStore($locale);
  const t = useStore($t);

  const toggleLanguage = () => {
    const newLocale: Locale = currentLocale === 'en' ? 'ja' : 'en';
    setLocale(newLocale);
  };

  return (
    <Tooltip label={t.languageSwitcher.description}>
      <Button
        variant="subtle"
        size="xs"
        leftSection={<Languages size={20} aria-hidden="true" />}
        onClick={toggleLanguage}
        aria-label={t.languageSwitcher.ariaLabel}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 100 }}
      >
        <Text size="sm" fw={500}>
          {t.languageSwitcher.label}
        </Text>
      </Button>
    </Tooltip>
  );
}
