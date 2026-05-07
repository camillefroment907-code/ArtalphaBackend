import { Suspense, useState, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { useTranslation } from 'react-i18next';
import { router } from './routes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieBanner } from './components/CookieBanner';

const SuspenseFallback = (
  <div style={{position:'fixed',inset:0,background:'#FAFAF8',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
    <span style={{fontFamily:'Georgia,serif',fontSize:13,letterSpacing:'0.3em',color:'#1A2A44',opacity:0.5,textTransform:'uppercase',animation:'fade 1.4s ease-in-out infinite'}}>
      Scanning...
    </span>
    <style>{'@keyframes fade{0%,100%{opacity:0.3}50%{opacity:0.8}}'}</style>
  </div>
);

export default function App() {
  const { i18n } = useTranslation();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // Force correct language on mount
    const stored = localStorage.getItem('i18nextLng');
    const browserLang = navigator.language?.startsWith('fr') ? 'fr' : 'en';
    const targetLang = stored || browserLang;
    if (i18n.language !== targetLang) {
      i18n.changeLanguage(targetLang);
    }
  }, []);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    i18n.on('languageChanged', handler);
    return () => i18n.off('languageChanged', handler);
  }, [i18n]);

  return (
    <ErrorBoundary>
      <Suspense fallback={SuspenseFallback}>
        <RouterProvider router={router} />
      </Suspense>
      <CookieBanner />
    </ErrorBoundary>
  );
}
