import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    // One output file per source module: with "sideEffects": false in
    // package.json, a consumer's bundler then drops every module it does not
    // import, whatever that module does while it loads. strip is its own
    // entry point and shares the modules it needs with the main one.
    entry: ['src/index.ts', 'src/strip.ts'],
    format: ['esm'],
    unbundle: true,
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
