import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'sd-metadata': resolve(__dirname, '../src/index.ts'),
    },
  },
});
