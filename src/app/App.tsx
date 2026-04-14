import { Suspense } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { PageLoader } from './components/PageLoader';

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
