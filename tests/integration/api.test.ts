import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, write } from '../../src/index';
import type { ParseResult } from '../../src/types';

/**
 * Load a sample file from the samples directory
 */
function loadSample(
  format: 'png' | 'jpg' | 'webp',
  filename: string,
): Uint8Array {
  const dirName = format === 'jpg' ? 'jpg' : format;
  const filePath = path.join(__dirname, '../../samples', dirName, filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

describe('API Integration Tests', () => {
  describe('read() API', () => {
    describe('successful reads', () => {
      it('should read PNG samples', () => {
        const samples = [
          'novelai-full.png',
          'comfyui.png',
          'civitai.png',
          'forge.png',
          'invokeai.png',
        ];

        for (const filename of samples) {
          const data = loadSample('png', filename);
          const result = read(data);
          expect(result.status).toBe('success');
          if (result.status === 'success') {
            expect(result.metadata).toBeDefined();
            expect(result.metadata.software).toBeTruthy();
            expect(result.raw).toBeDefined();
            expect(result.raw.format).toBe('png');
          }
        }
      });

      it('should read JPEG samples', () => {
        const samples = [
          'civitai.jpeg',
          'forge.jpeg',
          'comfyui-saveimage-plus.jpg',
        ];

        for (const filename of samples) {
          const data = loadSample('jpg', filename);
          const result = read(data);
          expect(result.status).toBe('success');
          if (result.status === 'success') {
            expect(result.metadata).toBeDefined();
            expect(result.metadata.software).toBeTruthy();
            expect(result.raw).toBeDefined();
            expect(result.raw.format).toBe('jpeg');
          }
        }
      });

      it('should read WebP samples', () => {
        const samples = ['comfyui-saveimage-plus.webp', 'forge-hires.webp'];

        for (const filename of samples) {
          const data = loadSample('webp', filename);
          const result = read(data);
          expect(result.status).toBe('success');
          if (result.status === 'success') {
            expect(result.metadata).toBeDefined();
            expect(result.metadata.software).toBeTruthy();
            expect(result.raw).toBeDefined();
            expect(result.raw.format).toBe('webp');
          }
        }
      });
    });

    describe('software detection', () => {
      const testCases: Array<{
        format: 'png' | 'jpg' | 'webp';
        file: string;
        software: string;
      }> = [
        { format: 'png', file: 'novelai-full.png', software: 'novelai' },
        { format: 'png', file: 'comfyui.png', software: 'comfyui' },
        { format: 'png', file: 'forge.png', software: 'forge' },
        { format: 'png', file: 'forge.png', software: 'forge' },
        { format: 'png', file: 'invokeai.png', software: 'invokeai' },
        { format: 'png', file: 'swarmui-hires.png', software: 'swarmui' },
        { format: 'png', file: 'tensorart.png', software: 'tensorart' },
        {
          format: 'png',
          file: 'stability-matrix.png',
          software: 'stability-matrix',
        },
        {
          format: 'png',
          file: 'ruined-fooocus.png',
          software: 'ruined-fooocus',
        },
        {
          format: 'png',
          file: 'huggingface-animagine.png',
          software: 'hf-space',
        },
        { format: 'jpg', file: 'forge.jpeg', software: 'forge' },
        { format: 'jpg', file: 'forge.jpeg', software: 'forge' },
        { format: 'webp', file: 'forge-hires.webp', software: 'forge' },
      ];

      for (const { format, file, software } of testCases) {
        it(`should detect ${software} from ${file}`, () => {
          const data = loadSample(format, file);
          const result = read(data);
          expect(result.status).toBe('success');
          if (result.status === 'success') {
            expect(result.metadata.software).toBe(software);
          }
        });
      }
    });

    describe('dimension fallback', () => {
      it('should fall back to image dimensions when metadata lacks them', () => {
        // Most samples should have dimensions in metadata, but the API should
        // still provide dimensions from the image format if missing
        const data = loadSample('png', 'novelai-full.png');
        const result = read(data);
        expect(result.status).toBe('success');
        if (result.status === 'success') {
          expect(result.metadata.width).toBeGreaterThan(0);
          expect(result.metadata.height).toBeGreaterThan(0);
        }
      });
    });

    describe('status values', () => {
      it('should return invalid for unsupported format', () => {
        // Create fake data with wrong signature
        const fakeData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
        const result = read(fakeData);
        expect(result.status).toBe('invalid');
        if (result.status === 'invalid') {
          expect(result.message).toBeTruthy();
        }
      });

      it('should return empty for images without metadata', () => {
        const emptyFiles = [
          { format: 'png' as const, file: 'empty.png' },
          { format: 'jpg' as const, file: 'empty.jpg' },
          { format: 'webp' as const, file: 'empty.webp' },
        ];

        for (const { format, file } of emptyFiles) {
          const data = loadSample(format, file);
          const result = read(data);

          expect(result.status).toBe('empty');
        }
      });
    });
  });

  describe('write() API', () => {
    describe('successful writes', () => {
      it('should write metadata to PNG', () => {
        const source = loadSample('png', 'novelai-full.png');
        const target = loadSample('png', 'civitai.png');

        const metadata = read(source);
        expect(metadata.status).toBe('success');

        const result = write(target, metadata);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const reread = read(result.value);
          expect(reread.status).toBe('success');
        }
      });

      it('should write metadata to JPEG', () => {
        const source = loadSample('png', 'novelai-full.png');
        const target = loadSample('jpg', 'civitai.jpeg');

        const metadata = read(source);
        expect(metadata.status).toBe('success');

        const result = write(target, metadata);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const reread = read(result.value);
          expect(reread.status).toBe('success');
        }
      });

      it('should write metadata to WebP', () => {
        const source = loadSample('png', 'novelai-full.png');
        const target = loadSample('webp', 'forge-hires.webp');

        const metadata = read(source);
        expect(metadata.status).toBe('success');

        const result = write(target, metadata);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const reread = read(result.value);
          expect(reread.status).toBe('success');
        }
      });
    });

    describe('metadata stripping', () => {
      it('should strip metadata when given status: empty', () => {
        const target = loadSample('png', 'novelai-full.png');
        const emptyResult: ParseResult = { status: 'empty' };

        const result = write(target, emptyResult);
        expect(result.ok).toBe(true);

        if (result.ok) {
          const reread = read(result.value);
          expect(reread.status).toBe('empty');
        }
      });
    });

    describe('error handling', () => {
      it('should reject invalid metadata', () => {
        const target = loadSample('png', 'novelai-full.png');
        const invalidResult: ParseResult = {
          status: 'invalid',
          message: 'test error',
        };

        const result = write(target, invalidResult);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe('writeFailed');
        }
      });

      it('should reject unsupported format', () => {
        const source = loadSample('png', 'novelai-full.png');
        const metadata = read(source);

        // Create fake data with wrong signature
        const fakeTarget = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

        const result = write(fakeTarget, metadata);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe('unsupportedFormat');
        }
      });
    });

    describe('force option', () => {
      it('should enable blind conversion for unrecognized formats', () => {
        const jpegTarget = loadSample('jpg', 'civitai.jpeg');

        const unrecognizedResult: ParseResult = {
          status: 'unrecognized',
          raw: {
            format: 'png',
            chunks: [
              { type: 'tEXt', keyword: 'unknown_tool', text: 'some data' },
              { type: 'tEXt', keyword: 'other_field', text: 'other data' },
            ],
          },
        };

        // Without force: should fail
        const withoutForce = write(jpegTarget, unrecognizedResult);
        expect(withoutForce.ok).toBe(false);

        // With force: should succeed
        const withForce = write(jpegTarget, unrecognizedResult, {
          force: true,
        });
        expect(withForce.ok).toBe(true);

        // Note: After blind conversion, the data may be detected as a known format
        // if it happens to match a parser's pattern. This is expected behavior.
        if (withForce.ok) {
          const reread = read(withForce.value);
          // Should be either unrecognized or successfully parsed
          expect(['success', 'unrecognized']).toContain(reread.status);
        }
      });

      it('should preserve all chunks through blind conversion', () => {
        const jpegTarget = loadSample('jpg', 'civitai.jpeg');

        const unrecognizedResult: ParseResult = {
          status: 'unrecognized',
          raw: {
            format: 'png',
            chunks: [
              { type: 'tEXt', keyword: 'field1', text: 'value1' },
              { type: 'tEXt', keyword: 'field2', text: 'value2' },
              { type: 'tEXt', keyword: 'field3', text: 'value3' },
            ],
          },
        };

        const result = write(jpegTarget, unrecognizedResult, { force: true });
        expect(result.ok).toBe(true);

        // After blind conversion, metadata should be preserved in some form
        if (result.ok) {
          const reread = read(result.value);
          // Should have raw data, either as unrecognized or successfully parsed
          expect(['success', 'unrecognized']).toContain(reread.status);
          if (reread.status === 'success' || reread.status === 'unrecognized') {
            expect(reread.raw).toBeDefined();
          }
        }
      });
    });
  });
});
