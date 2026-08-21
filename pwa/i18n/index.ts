import { Platform } from 'react-native';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

export type SupportedLanguage = 'en' | 'es';

const STORAGE_KEY = 'ht_language';

// expo-secure-store has no web implementation in this SDK version — same fallback
// pattern used by context/auth.tsx for storing the access token.
// Platform.OS is 'web' even during Netlify's build-time static rendering, which runs
// in plain Node.js with no real browser — localStorage doesn't exist there at all, so
// Platform.OS alone isn't enough; this must also check the global actually exists.
function hasLocalStorage(): boolean {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined';
}

function readStoredLanguage(): SupportedLanguage | null {
  if (!hasLocalStorage()) return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'en' || value === 'es' ? value : null;
}

export function storeLanguage(lang: SupportedLanguage): void {
  if (hasLocalStorage()) localStorage.setItem(STORAGE_KEY, lang);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: readStoredLanguage() ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
