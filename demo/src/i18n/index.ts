import { atom, computed } from 'nanostores';
import en from './en.json';
import ja from './ja.json';

/**
 * Supported locales
 */
export type Locale = 'en' | 'ja';

/**
 * Translation structure (inferred from en.json)
 */
export type I18nMessages = typeof en;

/**
 * Locale atom
 */
export const $locale = atom<Locale>('en');

/**
 * Translations map
 */
const translations: Record<Locale, I18nMessages> = {
  en,
  ja,
};

/**
 * Computed store for current translations
 */
export const $t = computed(
  $locale,
  (currentLocale) => translations[currentLocale],
);

/**
 * Get the browser's preferred language
 */
export function getBrowserLocale(): Locale {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('ja')) {
    return 'ja';
  }
  return 'en';
}

/**
 * Initialize locale from localStorage or browser
 */
export function initLocale(): void {
  const stored = localStorage.getItem('locale') as Locale | null;
  const initialLocale =
    stored && (stored === 'en' || stored === 'ja')
      ? stored
      : getBrowserLocale();

  $locale.set(initialLocale);
  document.documentElement.lang = initialLocale;
}

/**
 * Save the locale to localStorage and update store
 */
export function setLocale(newLocale: Locale): void {
  localStorage.setItem('locale', newLocale);
  $locale.set(newLocale);
  document.documentElement.lang = newLocale;
}
