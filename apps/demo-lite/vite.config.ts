import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const litePackageJson = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../packages/lite/package.json'),
    'utf-8',
  ),
);

export default defineConfig({
  define: {
    __LITE_VERSION__: JSON.stringify(litePackageJson.version),
  },
  // Fixed, distinct ports so demo and demo-lite can run side by side
  // without colliding with each other or Vite's defaults used elsewhere.
  server: { host: true, port: 5281, strictPort: true },
  preview: { port: 4281, strictPort: true },
  resolve: {
    alias: {
      // In local development, use the parent directory's source code directly
      // In production build (Cloudflare Pages), use the npm package
      ...(process.env.NODE_ENV !== 'production' && {
        '@enslo/sd-metadata-lite': resolve(
          import.meta.dirname,
          '../../packages/lite/src/index.ts',
        ),
      }),
    },
  },
});
