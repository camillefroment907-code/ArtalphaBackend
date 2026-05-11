import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import fr from './locales/fr';

// Browser is French → always use French, regardless of stored value
const browserIsFr = navigator.language?.startsWith('fr');
const stored = localStorage.getItem('i18nextLng');
const lang = browserIsFr ? 'fr' : (stored || 'en');

// Keep localStorage in sync
localStorage.setItem('i18nextLng', lang);

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr'],
    initImmediate: false,
    interpolation: { escapeValue: false },
    lng: lang,
  });

export default i18n;
