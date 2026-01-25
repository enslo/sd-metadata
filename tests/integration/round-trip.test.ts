import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, write } from '../../src/index';
import { expectNovelAIRawEqual, expectRawEqual } from '../helpers/raw-equal';

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

describe('Round-trip preservation', () => {
  describe('Same-format round-trips', () => {
    describe('PNG → PNG', () => {
      const pngSamples = [
        'novelai-full.png',
        'novelai-curated.png',
        'novelai-full-3char.png',
        'novelai-ref.png',
        'comfyui.png',
        'comfyui-hires.png',
        'comfyui-upscale.png',
        'comfyui-comfy-image-saver.png',
        'comfyui-save-image-extended.png',
        'comfyui-saveimage-plus.png',
        'comfyui-saveimagewithmetadata.png',
        'forge.png',
        'forge-en.png',
        'forge-hires.png',
        'forge-neo.png',
        'forge-neo-hires.png',
        'invokeai.png',
        'invokeai-en.png',
        'swarmui.png',
        'swarmui-hires.png',
        'swarmui-upscale.png',
        'tensorart.png',
        'stability-matrix.png',
        'stability-matrix-hires.png',
        'stability-matrix-upscale.png',
        'ruined-fooocus.png',
        'huggingface-animagine.png',
        'sd-next.png',
        'sd-next-en.png',
        'sd-next-hires.png',
      ];

      for (const filename of pngSamples) {
        it(`should preserve metadata for ${filename}`, () => {
          const original = loadSample('png', filename);
          const firstRead = read(original);

          // First read should succeed
          expect(firstRead.status).toBe('success');
          if (firstRead.status !== 'success') return;

          // Write metadata back
          const written = write(original, firstRead);
          expect(written.ok).toBe(true);
          if (!written.ok) return;

          // Read again
          const secondRead = read(written.value);
          expect(secondRead.status).toBe('success');
          if (secondRead.status !== 'success') return;

          // Metadata should be identical
          expect(secondRead.metadata).toEqual(firstRead.metadata);
          expectRawEqual(secondRead.raw, firstRead.raw);
        });
      }
    });

    describe('JPEG → JPEG', () => {
      const jpegSamples = [
        'civitai.jpeg',
        'civitai-hires.jpg',
        'civitai-upscale.jpg',
        'forge.jpeg',
        'comfyui-saveimage-plus.jpg',
        'sd-next.jpg',
        'sd-next-hires.jpg',
        'swarmui.jpg',
      ];

      for (const filename of jpegSamples) {
        it(`should preserve metadata for ${filename}`, () => {
          const original = loadSample('jpg', filename);
          const firstRead = read(original);

          expect(firstRead.status).toBe('success');
          if (firstRead.status !== 'success') return;

          const written = write(original, firstRead);
          expect(written.ok).toBe(true);
          if (!written.ok) return;

          const secondRead = read(written.value);
          expect(secondRead.status).toBe('success');
          if (secondRead.status !== 'success') return;

          expect(secondRead.metadata).toEqual(firstRead.metadata);
          expectRawEqual(secondRead.raw, firstRead.raw);
        });
      }
    });

    describe('WebP → WebP', () => {
      const webpSamples = [
        'comfyui-saveimage-plus.webp',
        'comfyui-saveimagewithmetadata.webp',
        'comfyui-comfy-image-saver.webp',
        'comfyui-save-image-extended.webp',
        'forge.webp',
        'forge-hires.webp',
        'forge-neo.webp',
        'swarmui.webp',
        'novelai-curated.webp',
        'novelai-full-3char.webp',
        'sd-next.webp',
        'sd-next-hires.webp',
      ];

      for (const filename of webpSamples) {
        it(`should preserve metadata for ${filename}`, () => {
          const original = loadSample('webp', filename);
          const firstRead = read(original);

          expect(firstRead.status).toBe('success');
          if (firstRead.status !== 'success') return;

          const written = write(original, firstRead);
          expect(written.ok).toBe(true);
          if (!written.ok) return;

          const secondRead = read(written.value);
          expect(secondRead.status).toBe('success');
          if (secondRead.status !== 'success') return;

          expect(secondRead.metadata).toEqual(firstRead.metadata);
          expectRawEqual(secondRead.raw, firstRead.raw);
        });
      }
    });
  });

  describe('Cross-format round-trips', () => {
    describe('PNG → JPEG → PNG', () => {
      const testCases = [
        { file: 'novelai-full.png', tool: 'NovelAI' },
        { file: 'comfyui.png', tool: 'ComfyUI' },
        { file: 'forge.png', tool: 'Forge' },
        { file: 'invokeai.png', tool: 'InvokeAI' },
        { file: 'swarmui-hires.png', tool: 'SwarmUI' },
        { file: 'tensorart.png', tool: 'TensorArt' },
        { file: 'stability-matrix.png', tool: 'Stability Matrix' },
        { file: 'huggingface-animagine.png', tool: 'HF-Space' },
        { file: 'ruined-fooocus.png', tool: 'Ruined Fooocus' },
      ];

      for (const { file, tool } of testCases) {
        it(`should preserve ${tool} metadata through PNG → JPEG → PNG`, () => {
          const pngOriginal = loadSample('png', file);
          const originalMetadata = read(pngOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // Get a JPEG image to write to (use any sample JPEG)
          const jpegBase = loadSample('jpg', 'civitai.jpeg');

          // PNG → JPEG
          const jpegWithMetadata = write(jpegBase, originalMetadata);
          expect(jpegWithMetadata.ok).toBe(true);
          if (!jpegWithMetadata.ok) return;

          const jpegRead = read(jpegWithMetadata.value);
          expect(jpegRead.status).toBe('success');
          if (jpegRead.status !== 'success') return;

          // JPEG → PNG
          const pngRestored = write(pngOriginal, jpegRead);
          expect(pngRestored.ok).toBe(true);
          if (!pngRestored.ok) return;

          const finalRead = read(pngRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          // Metadata should match original
          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('PNG → WebP → PNG', () => {
      const testCases = [
        { file: 'novelai-full.png', tool: 'NovelAI' },
        { file: 'comfyui.png', tool: 'ComfyUI' },
        { file: 'forge.png', tool: 'Forge' },
        { file: 'invokeai.png', tool: 'InvokeAI' },
        { file: 'swarmui-hires.png', tool: 'SwarmUI' },
        { file: 'tensorart.png', tool: 'TensorArt' },
        { file: 'stability-matrix.png', tool: 'Stability Matrix' },
        { file: 'huggingface-animagine.png', tool: 'HF-Space' },
        { file: 'ruined-fooocus.png', tool: 'Ruined Fooocus' },
      ];

      for (const { file, tool } of testCases) {
        it(`should preserve ${tool} metadata through PNG → WebP → PNG`, () => {
          const pngOriginal = loadSample('png', file);
          const originalMetadata = read(pngOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // Get a WebP image to write to
          const webpBase = loadSample('webp', 'forge-hires.webp');

          // PNG → WebP
          const webpWithMetadata = write(webpBase, originalMetadata);
          expect(webpWithMetadata.ok).toBe(true);
          if (!webpWithMetadata.ok) return;

          const webpRead = read(webpWithMetadata.value);
          expect(webpRead.status).toBe('success');
          if (webpRead.status !== 'success') return;

          // WebP → PNG
          const pngRestored = write(pngOriginal, webpRead);
          expect(pngRestored.ok).toBe(true);
          if (!pngRestored.ok) return;

          const finalRead = read(pngRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('JPEG → WebP → JPEG', () => {
      const testCases = [
        { file: 'civitai.jpeg', tool: 'Civitai' },
        { file: 'comfyui-saveimage-plus.jpg', tool: 'ComfyUI' },
        { file: 'forge.jpeg', tool: 'Forge' },
      ];

      for (const { file, tool } of testCases) {
        it(`should preserve ${tool} metadata through JPEG → WebP → JPEG`, () => {
          const jpegOriginal = loadSample('jpg', file);
          const originalMetadata = read(jpegOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // Get a WebP image to write to
          const webpBase = loadSample('webp', 'forge-hires.webp');

          // JPEG → WebP
          const webpWithMetadata = write(webpBase, originalMetadata);
          expect(webpWithMetadata.ok).toBe(true);
          if (!webpWithMetadata.ok) return;

          const webpRead = read(webpWithMetadata.value);
          expect(webpRead.status).toBe('success');
          if (webpRead.status !== 'success') return;

          // WebP → JPEG
          const jpegRestored = write(jpegOriginal, webpRead);
          expect(jpegRestored.ok).toBe(true);
          if (!jpegRestored.ok) return;

          const finalRead = read(jpegRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('JPEG → PNG → JPEG', () => {
      const testCases = [
        { file: 'civitai.jpeg', tool: 'Civitai' },
        { file: 'comfyui-saveimage-plus.jpg', tool: 'ComfyUI' },
        { file: 'forge.jpeg', tool: 'Forge' },
        { file: 'swarmui.jpg', tool: 'SwarmUI' },
        { file: 'sd-next.jpg', tool: 'SD.Next' },
      ];

      for (const { file, tool } of testCases) {
        it(`should preserve ${tool} metadata through JPEG → PNG → JPEG`, () => {
          const jpegOriginal = loadSample('jpg', file);
          const originalMetadata = read(jpegOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // Get a PNG image to write to
          const pngBase = loadSample('png', 'forge.png');

          // JPEG → PNG
          const pngWithMetadata = write(pngBase, originalMetadata);
          expect(pngWithMetadata.ok).toBe(true);
          if (!pngWithMetadata.ok) return;

          const pngRead = read(pngWithMetadata.value);
          expect(pngRead.status).toBe('success');
          if (pngRead.status !== 'success') return;

          // PNG → JPEG
          const jpegRestored = write(jpegOriginal, pngRead);
          expect(jpegRestored.ok).toBe(true);
          if (!jpegRestored.ok) return;

          const finalRead = read(jpegRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });

    describe('WebP → PNG → WebP', () => {
      const testCases = [
        { file: 'comfyui-saveimage-plus.webp', tool: 'ComfyUI' },
        { file: 'forge-hires.webp', tool: 'Forge' },
        { file: 'swarmui.webp', tool: 'SwarmUI' },
        { file: 'novelai-curated.webp', tool: 'NovelAI' },
        { file: 'sd-next.webp', tool: 'SD.Next' },
      ];

      for (const { file, tool } of testCases) {
        it(`should preserve ${tool} metadata through WebP → PNG → WebP`, () => {
          const webpOriginal = loadSample('webp', file);
          const originalMetadata = read(webpOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // Get a PNG image to write to
          const pngBase = loadSample('png', 'forge.png');

          // WebP → PNG
          const pngWithMetadata = write(pngBase, originalMetadata);
          expect(pngWithMetadata.ok).toBe(true);
          if (!pngWithMetadata.ok) return;

          const pngRead = read(pngWithMetadata.value);
          expect(pngRead.status).toBe('success');
          if (pngRead.status !== 'success') return;

          // PNG → WebP
          const webpRestored = write(webpOriginal, pngRead);
          expect(webpRestored.ok).toBe(true);
          if (!webpRestored.ok) return;

          const finalRead = read(webpRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          // Parsed metadata should always match
          expect(finalRead.metadata).toEqual(originalMetadata.metadata);

          // Raw metadata validation
          if (tool === 'NovelAI') {
            // NovelAI: partial check due to intentional Description correction
            expectNovelAIRawEqual(finalRead.raw, originalMetadata.raw);
          } else {
            // Other tools: full content-equivalent check
            expectRawEqual(finalRead.raw, originalMetadata.raw);
          }
        });
      }
    });

    describe('WebP → JPEG → WebP', () => {
      const testCases = [
        { file: 'comfyui-saveimage-plus.webp', tool: 'ComfyUI' },
        { file: 'forge-hires.webp', tool: 'Forge' },
        { file: 'swarmui.webp', tool: 'SwarmUI' },
        { file: 'novelai-curated.webp', tool: 'NovelAI' },
      ];

      for (const { file, tool } of testCases) {
        it(`should preserve ${tool} metadata through WebP → JPEG → WebP`, () => {
          const webpOriginal = loadSample('webp', file);
          const originalMetadata = read(webpOriginal);
          expect(originalMetadata.status).toBe('success');
          if (originalMetadata.status !== 'success') return;

          // Get a JPEG image to write to
          const jpegBase = loadSample('jpg', 'civitai.jpeg');

          // WebP → JPEG
          const jpegWithMetadata = write(jpegBase, originalMetadata);
          expect(jpegWithMetadata.ok).toBe(true);
          if (!jpegWithMetadata.ok) return;

          const jpegRead = read(jpegWithMetadata.value);
          expect(jpegRead.status).toBe('success');
          if (jpegRead.status !== 'success') return;

          // JPEG → WebP
          const webpRestored = write(webpOriginal, jpegRead);
          expect(webpRestored.ok).toBe(true);
          if (!webpRestored.ok) return;

          const finalRead = read(webpRestored.value);
          expect(finalRead.status).toBe('success');
          if (finalRead.status !== 'success') return;

          expect(finalRead.metadata).toEqual(originalMetadata.metadata);
          expectRawEqual(finalRead.raw, originalMetadata.raw);
        });
      }
    });
  });
});
