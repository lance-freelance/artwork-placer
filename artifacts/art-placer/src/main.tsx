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

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <Router base={routerBase}>
      <App />
    </Router>
  </QueryClientProvider>,
);
