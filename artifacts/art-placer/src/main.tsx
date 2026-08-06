import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';

import App from './App';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** The app is served under a base path prefix, so routes are relative to it. */
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '');

// Temporary: instrumentation for the first-drag-after-load bug, in its own
// chunk and only fetched when asked for with `?debugDrag=1`. Remove this and
// src/dev/dragDiagnostics.ts once the cause is pinned down.
if (new URLSearchParams(window.location.search).has('debugDrag')) {
  void import('./dev/dragDiagnostics').then((m) => m.startDragDiagnostics());
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <Router base={routerBase}>
      <App />
    </Router>
  </QueryClientProvider>,
);
