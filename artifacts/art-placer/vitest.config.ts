import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    // Vitest doesn't inject import.meta.env.BASE_URL automatically for
    // non-Vite test runs; provide a sensible default so any module that
    // reads it at import time doesn't throw.
    'import.meta.env.BASE_URL': JSON.stringify('/'),
  },
});
