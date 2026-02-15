import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
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

  const languageLabel = currentLocale === 'en' ? 'EN' : 'JA';

  return (
    <Tooltip
      label={
        currentLocale === 'en'
          ? t.languageSwitcher.switchToJapanese
          : t.languageSwitcher.switchToEnglish
      }
    >
      <ActionIcon
        variant="subtle"
        size="lg"
        onClick={toggleLanguage}
        aria-label={t.languageSwitcher.ariaLabel}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 100 }}
      >
        <Group gap={4}>
          <Languages size={20} aria-hidden="true" />
          <Text size="sm" fw={500}>
            {languageLabel}
          </Text>
        </Group>
      </ActionIcon>
    </Tooltip>
  );
}
