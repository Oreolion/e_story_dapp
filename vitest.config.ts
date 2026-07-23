import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './__tests__/setup.ts',
    exclude: ['node_modules', 'cre/**/node_modules/**', 'e2e/**/*', 'mobile/**/*', '.next', 'out', 'dist'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://mock.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
    },
  },
});
