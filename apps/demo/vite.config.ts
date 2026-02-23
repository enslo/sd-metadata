import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      // In local development, use the parent directory's source code directly
      // In production build (Cloudflare Pages), use the npm package
      ...(process.env.NODE_ENV !== 'production' && {
        '@enslo/sd-metadata': resolve(
          __dirname,
          '../../packages/core/src/index.ts',
        ),
      }),
    },
  },
});
