/**
 * Build a minimal IIFE bundle from ESM output.
 *
 * esbuild's IIFE format adds ~500 bytes of ESM interop boilerplate.
 * This script bundles as ESM and wraps with a simple IIFE instead.
 *
 * A second minification pass with terser squeezes ~100 extra bytes
 * via collapse_vars, merge_vars, and other optimizations esbuild
 * does not perform.
 */

import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { minify } from 'terser';

const result = await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2022',
});

const esm = result.outputFiles[0]?.text ?? '';

// Extract the mangled name for `parse` from the ESM export statement.
// esbuild renames `parse` to a short identifier (e.g. `Y`) and emits
// `export{Y as parse}`. We need the internal name for the IIFE return.
const exportMatch = esm.match(/export\{(\w+) as parse\}/);
const parseName = exportMatch?.[1] ?? 'parse';

// Strip the ESM export statement and wrap in IIFE
const code = esm.replace(/export\{[^}]+\};?\s*$/, '').trimEnd();
const wrapped = `var sdml=(()=>{${code}return{parse:${parseName}}})();\n`;

// Second pass: terser catches optimizations esbuild misses
const terserResult = await minify(wrapped, {
  compress: {
    ecma: 2020,
    passes: 3,
    unsafe: true,
    collapse_vars: true,
    reduce_vars: true,
  },
  mangle: true,
  format: {
    ecma: 2020,
  },
});

const iife = terserResult.code ?? wrapped;

writeFileSync('dist/index.global.js', iife);

const bytes = Buffer.byteLength(iife);
const kb = (bytes / 1024).toFixed(2);
console.log(`IIFE dist/index.global.js ${kb} KB (${bytes} bytes)`);
