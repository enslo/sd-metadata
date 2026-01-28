import { useStore } from '@nanostores/preact';
import { Languages } from 'lucide-preact';
import type { Locale } from '../../i18n';
import { $locale, $t, setLocale } from '../../i18n';
import styles from './LanguageSwitcher.module.css';

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
    <button
      type="button"
      class={styles.switcher}
      onClick={toggleLanguage}
      aria-label={t.languageSwitcher.ariaLabel}
      title={
        currentLocale === 'en'
          ? t.languageSwitcher.switchToJapanese
          : t.languageSwitcher.switchToEnglish
      }
    >
      <Languages size={20} aria-hidden="true" />
      <span>{languageLabel}</span>
    </button>
  );
}
