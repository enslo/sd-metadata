import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    fixedExtension: false,
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'sdMetadata',
    minify: true,
    fixedExtension: false,
    outputOptions: {
      entryFileNames: 'index.global.js',
    },
  },
]);
