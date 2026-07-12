import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Dev proxy: the backend does not enable CORS yet (deferred to Phase 18), so
// the SPA talks to a same-origin `/api` path that Vite forwards to Nest.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      // Socket.IO (chat + notifications namespaces) shares the default
      // `/socket.io` path; `ws: true` upgrades the connection through the proxy
      // so realtime works same-origin without CORS (still deferred to Phase 18).
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      // Coverage scope = application logic + reusable components:
      //   lib/, hooks/, stores/, feature api+hooks+schemas (features/**/*.ts),
      //   and shared/form/brand/routing components.
      // Excluded from the denominator (driven by Playwright E2E, not unit tests):
      //   pages/ shells, the private app shell (components/layout, app/), the
      //   shadcn/ui primitives, and feature presentational components
      //   (features/**/components). Plus entrypoint/config/generated types.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/lib/api-types.ts',
        'src/pages/**',
        'src/app/**',
        'src/components/ui/**',
        'src/components/layout/**',
        'src/features/**/components/**',
      ],
    },
  },
});
