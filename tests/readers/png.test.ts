import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPngMetadata } from '../../src/readers/png';

const SAMPLES_DIR = join(__dirname, '../../samples/png');

/**
 * Load sample PNG file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

describe('readPngMetadata', () => {
  describe('signature validation', () => {
    it('should return error for invalid signature', () => {
      const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });

    it('should return error for empty data', () => {
      const data = new Uint8Array([]);
      const result = readPngMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('NovelAI', () => {
    it('should detect NovelAI from novelai-full.png', () => {
      const data = loadSample('novelai-full.png');
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('novelai');
        expect(result.value.chunks.length).toBeGreaterThan(0);

        // Check for expected chunks
        const keywords = result.value.chunks.map((c) => c.keyword);
        expect(keywords).toContain('Software');
        expect(keywords).toContain('Comment');
      }
    });
  });

  describe('ComfyUI', () => {
    it('should detect ComfyUI from comfyui.png', () => {
      const data = loadSample('comfyui.png');
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');

        const keywords = result.value.chunks.map((c) => c.keyword);
        expect(keywords).toContain('prompt');
        expect(keywords).toContain('workflow');
      }
    });
  });

  describe('Forge Neo', () => {
    it('should detect Forge Neo from forge-neo.png', () => {
      const data = loadSample('forge-neo.png');
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('forge-neo');

        const keywords = result.value.chunks.map((c) => c.keyword);
        expect(keywords).toContain('parameters');
      }
    });
  });

  describe('SwarmUI', () => {
    it('should detect SwarmUI from swarmui.png', () => {
      const data = loadSample('swarmui.png');
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('swarmui');

        const keywords = result.value.chunks.map((c) => c.keyword);
        expect(keywords).toContain('prompt');
        expect(keywords).toContain('parameters');
      }
    });
  });

  describe('InvokeAI', () => {
    it('should detect InvokeAI from invokeai.png', () => {
      const data = loadSample('invokeai.png');
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('invokeai');

        const keywords = result.value.chunks.map((c) => c.keyword);
        expect(keywords).toContain('invokeai_metadata');
      }
    });
  });

  describe('TensorArt', () => {
    it('should detect TensorArt from tensorart.png', () => {
      const data = loadSample('tensorart.png');
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('tensorart');

        const keywords = result.value.chunks.map((c) => c.keyword);
        expect(keywords).toContain('generation_data');
      }
    });
  });

  describe('Stability Matrix', () => {
    it('should detect Stability Matrix from stability-matrix.png', () => {
      const data = loadSample('stability-matrix.png');
      const result = readPngMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('stability-matrix');

        const keywords = result.value.chunks.map((c) => c.keyword);
        expect(keywords).toContain('smproj');
      }
    });
  });
});
