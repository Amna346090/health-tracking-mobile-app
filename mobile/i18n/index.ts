import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import en from './locales/en.json';
import es from './locales/es.json';

export type SupportedLanguage = 'en' | 'es';

const STORAGE_KEY = 'ht_language';

export async function readStoredLanguage(): Promise<SupportedLanguage | null> {
  const value = await SecureStore.getItemAsync(STORAGE_KEY);
  return value === 'en' || value === 'es' ? value : null;
}

export async function storeLanguage(lang: SupportedLanguage): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, lang);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // Hermes in Expo Go doesn't ship a full Intl.PluralRules implementation, which
  // makes i18next log a console.error before silently falling back to this same
  // format anyway — setting it explicitly skips the probe and the noisy LogBox.
  compatibilityJSON: 'v3',
});

// SecureStore has no synchronous read, so init starts in English and swaps to the
// saved language (if any) once the async lookup resolves — mirrors the brief flash
// pattern already accepted for auth-token restoration in context/auth.tsx.
readStoredLanguage().then((lang) => {
  if (lang) i18n.changeLanguage(lang);
});

export default i18n;
