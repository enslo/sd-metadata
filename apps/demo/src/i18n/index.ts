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
 * The stored locale choice, or null when there is none or storage is
 * unavailable (blocked cookies, a sandboxed frame, some private modes
 * throw on touching localStorage)
 */
function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem('locale');
    return stored === 'en' || stored === 'ja' ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Store the locale choice; without storage it lasts for this page only
 */
function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem('locale', locale);
  } catch {
    // Storage is unavailable; see readStoredLocale
  }
}

/**
 * Initialize locale from localStorage or browser
 */
export function initLocale(): void {
  const initialLocale = readStoredLocale() ?? getBrowserLocale();

  $locale.set(initialLocale);
  document.documentElement.lang = initialLocale;
}

/**
 * Save the locale to localStorage and update store
 */
export function setLocale(newLocale: Locale): void {
  storeLocale(newLocale);
  $locale.set(newLocale);
  document.documentElement.lang = newLocale;
}
