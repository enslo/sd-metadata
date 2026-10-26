import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const corePackageJson = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../packages/core/package.json'),
    'utf-8',
  ),
);

export default defineConfig({
  plugins: [react()],
  define: {
    __CORE_VERSION__: JSON.stringify(corePackageJson.version),
  },
  // Fixed, distinct ports so demo and demo-lite can run side by side
  // without colliding with each other or Vite's defaults used elsewhere.
  server: { host: true, port: 5280, strictPort: true },
  preview: { port: 4280, strictPort: true },
  resolve: {
    alias: {
      // In local development, use the parent directory's source code directly
      // In production build (Cloudflare Pages), use the npm package
      ...(process.env.NODE_ENV !== 'production' && {
        '@enslo/sd-metadata': resolve(
          import.meta.dirname,
          '../../packages/core/src/index.ts',
        ),
      }),
    },
  },
});
