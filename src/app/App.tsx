import { Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import NautilusLoader from './components/NautilusLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieBanner } from './components/CookieBanner';

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<NautilusLoader />}>
        <RouterProvider router={router} />
      </Suspense>
      <CookieBanner />
    </ErrorBoundary>
  );
}
