import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const litePackageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../packages/lite/package.json'), 'utf-8'),
);

export default defineConfig({
  define: {
    __LITE_VERSION__: JSON.stringify(litePackageJson.version),
  },
  resolve: {
    alias: {
      // In local development, use the parent directory's source code directly
      // In production build (Cloudflare Pages), use the npm package
      ...(process.env.NODE_ENV !== 'production' && {
        '@enslo/sd-metadata-lite': resolve(
          __dirname,
          '../../packages/lite/src/index.ts',
        ),
      }),
    },
  },
});
