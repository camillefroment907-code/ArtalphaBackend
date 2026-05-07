import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import fr from './locales/fr';

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr'],
    initImmediate: false,
    interpolation: { escapeValue: false },
    lng: localStorage.getItem('i18nextLng') || (navigator.language?.startsWith('fr') ? 'fr' : 'en'),
  });

// Force language from localStorage on every load
const storedLang = localStorage.getItem('i18nextLng');
if (storedLang && storedLang !== i18n.language) {
  i18n.changeLanguage(storedLang);
}

export default i18n;
