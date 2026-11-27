import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    // strip is its own entry point; the code both share goes into a chunk
    entry: ['src/index.ts', 'src/strip.ts'],
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
      comments: { annotation: false },
    },
  },
]);
