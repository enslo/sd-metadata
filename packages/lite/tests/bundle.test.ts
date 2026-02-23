import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as srcParse } from '../src/index';

const DIST = join(import.meta.dirname, '../dist');
const IIFE_PATH = join(DIST, 'index.global.js');
const ESM_PATH = join(DIST, 'index.js');
const SAMPLES = join(import.meta.dirname, '../../../samples');

// Evaluate the IIFE bundle and extract the parse function.
// The IIFE assigns `var sdml = (()=>{...})();` at the top level.
const iifeCode = readFileSync(IIFE_PATH, 'utf-8');
const iifeParse: (input: Uint8Array | ArrayBuffer) => string = new Function(
  `${iifeCode}; return sdml;`,
)().parse;

function load(format: string, file: string): Uint8Array {
  return new Uint8Array(readFileSync(join(SAMPLES, format, file)));
}

function listSamples(format: string, ext: RegExp): string[] {
  return readdirSync(join(SAMPLES, format)).filter((f: string) => ext.test(f));
}

const pngFiles = listSamples('png', /\.png$/);
const jpgFiles = listSamples('jpg', /\.jpe?g$/);
const webpFiles = listSamples('webp', /\.webp$/);

describe('IIFE bundle', () => {
  it('should export a parse function', () => {
    expect(typeof iifeParse).toBe('function');
  });

  it('should return empty string for non-image data', () => {
    expect(iifeParse(new Uint8Array([0, 0, 0, 0]))).toBe('');
  });

  describe('PNG samples', () => {
    for (const file of pngFiles) {
      it(`should match source output for ${file}`, () => {
        const data = load('png', file);
        expect(iifeParse(data)).toBe(srcParse(data));
      });
    }
  });

  describe('JPEG samples', () => {
    for (const file of jpgFiles) {
      it(`should match source output for ${file}`, () => {
        const data = load('jpg', file);
        expect(iifeParse(data)).toBe(srcParse(data));
      });
    }
  });

  describe('WebP samples', () => {
    for (const file of webpFiles) {
      it(`should match source output for ${file}`, () => {
        const data = load('webp', file);
        expect(iifeParse(data)).toBe(srcParse(data));
      });
    }
  });
});

describe('ESM bundle', () => {
  it('should exist with type declarations', () => {
    expect(statSync(ESM_PATH).size).toBeGreaterThan(0);
    expect(statSync(join(DIST, 'index.d.ts')).size).toBeGreaterThan(0);
  });
});
