import { Suspense } from 'react';
import { RouterProvider } from 'react-router';
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
  return (
    <ErrorBoundary>
      <Suspense fallback={SuspenseFallback}>
        <RouterProvider router={router} />
      </Suspense>
      <CookieBanner />
    </ErrorBoundary>
  );
}
