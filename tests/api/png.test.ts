import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePng } from '../../src/api/png';

/**
 * Load sample PNG file as Uint8Array
 */
function loadSample(filename: string): Uint8Array {
  const filePath = path.join('samples/png', filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

describe('parsePng', () => {
  it('should return error for invalid PNG', () => {
    const data = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = parsePng(data);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('parseError');
      if (result.error.type === 'parseError') {
        expect(result.error.message).toBe('Not a valid PNG file');
      }
    }
  });

  describe('NovelAI samples', () => {
    it('should parse novelai-full.png', () => {
      const data = loadSample('novelai-full.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('novelai');
        expect(result.value.prompt).toBeTruthy();
        expect(result.value.width).toBeGreaterThan(0);
      }
    });

    it('should parse novelai-curated.png', () => {
      const data = loadSample('novelai-curated.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('novelai');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse novelai-full-3char.png', () => {
      const data = loadSample('novelai-full-3char.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('novelai');
        expect(result.value.prompt).toBeTruthy();
      }
    });
  });

  describe('ComfyUI samples', () => {
    it('should parse comfyui.png', () => {
      const data = loadSample('comfyui.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse comfyui-hires.png', () => {
      const data = loadSample('comfyui-hires.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
      }
    });

    it('should parse comfyui-upscale.png', () => {
      const data = loadSample('comfyui-upscale.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
      }
    });

    it('should parse comfyui-comfy-image-saver.png', () => {
      const data = loadSample('comfyui-comfy-image-saver.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
      }
    });

    it('should parse comfyui-save-image-extended.png', () => {
      const data = loadSample('comfyui-save-image-extended.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
      }
    });

    it('should parse comfyui-saveimage-plus.png', () => {
      const data = loadSample('comfyui-saveimage-plus.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
      }
    });

    it('should parse comfyui-saveimagewithmetadata.png', () => {
      const data = loadSample('comfyui-saveimagewithmetadata.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Uses A1111 format
        expect(result.value.software).toBe('sd-webui');
      }
    });
  });

  describe('Forge samples', () => {
    it('should parse forge-neo.png', () => {
      const data = loadSample('forge-neo.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('forge-neo');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse forge-neo-hires.png', () => {
      const data = loadSample('forge-neo-hires.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('forge-neo');
      }
    });
  });

  describe('SwarmUI samples', () => {
    it('should parse swarmui.png', () => {
      const data = loadSample('swarmui.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('swarmui');
        expect(result.value.prompt).toBeTruthy();
      }
    });

    it('should parse swarmui-hires.png', () => {
      const data = loadSample('swarmui-hires.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('swarmui');
      }
    });

    it('should parse swarmui-upscale.png', () => {
      const data = loadSample('swarmui-upscale.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('swarmui');
      }
    });
  });

  describe('Stability Matrix samples', () => {
    it('should parse stability-matrix.png', () => {
      const data = loadSample('stability-matrix.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('stability-matrix');
      }
    });

    it('should parse stability-matrix-hires.png', () => {
      const data = loadSample('stability-matrix-hires.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('stability-matrix');
      }
    });

    it('should parse stability-matrix-upscale.png', () => {
      const data = loadSample('stability-matrix-upscale.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('stability-matrix');
      }
    });
  });

  describe('Other tools', () => {
    it('should parse civitai.png', () => {
      const data = loadSample('civitai.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('sd-webui');
      }
    });

    it('should parse invokeai.png', () => {
      const data = loadSample('invokeai.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('invokeai');
      }
    });

    it('should parse tensorart.png', () => {
      const data = loadSample('tensorart.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('tensorart');
      }
    });

    it('should parse huggingface-animagine.png', () => {
      const data = loadSample('huggingface-animagine.png');
      const result = parsePng(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('hf-space');
        expect(result.value.prompt).toBeTruthy();
        expect(result.value.width).toBeGreaterThan(0);
      }
    });
  });
});
