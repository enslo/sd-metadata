import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  // Exclude tests from the dts program: tests import ../../core/src, and
  // declaration emit for files outside this package writes stray .d.ts
  // files next to their sources (tsc CLI behavior, hit since TS 7 because
  // rolldown-plugin-dts spawns tsgo instead of using the in-memory API).
  tsconfig: 'tsconfig.build.json',
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  fixedExtension: false,
});
