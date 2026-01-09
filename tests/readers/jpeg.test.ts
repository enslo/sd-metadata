import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectSoftware } from '../../src/parsers/detect';
import { findApp1Segment, readJpegMetadata } from '../../src/readers/jpeg';
import { isJpeg } from '../../src/utils/binary';
import { pngChunksToEntries } from '../../src/utils/convert';

const SAMPLES_DIR = join(__dirname, '../../samples/jpg');

/**
 * Load sample JPEG file
 */
function loadSample(filename: string): Uint8Array {
  const path = join(SAMPLES_DIR, filename);
  return new Uint8Array(readFileSync(path));
}

/**
 * Helper to get first segment data from result
 */
function getFirstSegmentData(
  result: ReturnType<typeof readJpegMetadata>,
): string | null {
  if (!result.ok) return null;
  return result.value[0]?.data ?? null;
}

describe('readJpegMetadata', () => {
  describe('signature validation', () => {
    it('should return true for valid JPEG signature', () => {
      const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(isJpeg(data)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      expect(isJpeg(data)).toBe(false);
    });

    it('should return false for empty data', () => {
      const data = new Uint8Array([]);
      expect(isJpeg(data)).toBe(false);
    });

    it('should return error for invalid signature', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalidSignature');
      }
    });
  });

  describe('APP1 segment parsing', () => {
    it('should find APP1 segment in valid JPEG', () => {
      const data = loadSample('civitai.jpeg');
      const segment = findApp1Segment(data);

      expect(segment).not.toBeNull();
      if (segment) {
        expect(segment.offset).toBeGreaterThan(0);
        expect(segment.length).toBeGreaterThan(0);
      }
    });

    it('should return null for JPEG without APP1', () => {
      // Minimal JPEG with just SOI and EOI
      const data = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      const segment = findApp1Segment(data);

      expect(segment).toBeNull();
    });
  });

  describe('sample file tests', () => {
    it('should extract metadata from civitai.jpeg', () => {
      const data = loadSample('civitai.jpeg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
        const firstData = getFirstSegmentData(result);
        expect(firstData).toContain('Steps:');
        expect(firstData).toContain('Civitai resources:');
      }
    });

    it('should extract metadata from forge-neo.jpeg', () => {
      const data = loadSample('forge-neo.jpeg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(getFirstSegmentData(result)).toContain('Version: neo');
      }
    });

    it('should extract metadata from comfyui-comfy-image-saver.jpeg', () => {
      const data = loadSample('comfyui-comfy-image-saver.jpeg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(getFirstSegmentData(result)).toContain('Version: ComfyUI');
      }
    });

    it('should extract metadata from comfyui-saveimage-plus.jpg', () => {
      const data = loadSample('comfyui-saveimage-plus.jpg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(getFirstSegmentData(result)).toContain('"prompt"');
      }
    });

    it('should extract metadata from comfyui-saveimagewithmetadata.jpeg', () => {
      const data = loadSample('comfyui-saveimagewithmetadata.jpeg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // This uses A1111 format
        expect(getFirstSegmentData(result)).toContain('Steps:');
      }
    });

    it('should extract metadata from swarmui.jpg', () => {
      const data = loadSample('swarmui.jpg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(getFirstSegmentData(result)).toContain('sui_image_params');
      }
    });

    it('should extract metadata from civitai-hires.jpg', () => {
      const data = loadSample('civitai-hires.jpg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // This uses JSON format with civitai: URN
        expect(getFirstSegmentData(result)).toContain('civitai:');
      }
    });

    it('should extract metadata from civitai-upscale.jpg', () => {
      const data = loadSample('civitai-upscale.jpg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it('should extract multiple segments from comfyui-save-image-extended.jpeg', () => {
      const data = loadSample('comfyui-save-image-extended.jpeg');
      const result = readJpegMetadata(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // This file uses ImageDescription (Workflow:) and Make (Prompt:)
        expect(result.value.length).toBe(2);

        // Check ImageDescription segment (Workflow)
        const workflowSegment = result.value.find(
          (s) => s.source.type === 'exifImageDescription',
        );
        expect(workflowSegment).toBeDefined();
        expect(workflowSegment?.source).toEqual({
          type: 'exifImageDescription',
          prefix: 'Workflow',
        });
        expect(workflowSegment?.data).toContain('"nodes"');

        // Check Make segment (Prompt)
        const promptSegment = result.value.find(
          (s) => s.source.type === 'exifMake',
        );
        expect(promptSegment).toBeDefined();
        expect(promptSegment?.source).toEqual({
          type: 'exifMake',
          prefix: 'Prompt',
        });
        expect(promptSegment?.data).toContain('"inputs"');
      }
    });
  });
});

// Move software detection tests to a separate describe block for detectSoftware
describe('detectSoftware', () => {
  // Helper to create entries from content
  function createEntries(keyword: string, text: string) {
    return [{ keyword, text }];
  }

  it('should detect Civitai from Civitai resources', () => {
    const content = 'Steps: 25, Civitai resources: [{...}]';
    expect(detectSoftware(createEntries('Comment', content))).toBe('civitai');
  });

  it('should detect Forge Neo from Version: neo', () => {
    const content = 'Steps: 24, Version: neo';
    expect(detectSoftware(createEntries('Comment', content))).toBe('forge-neo');
  });

  it('should detect ComfyUI from JSON with prompt', () => {
    const content = '{"prompt": {"1": {}}}';
    expect(detectSoftware(createEntries('Comment', content))).toBe('comfyui');
  });

  it('should detect SwarmUI from sui_image_params', () => {
    const content = '{"sui_image_params": {}}';
    expect(detectSoftware(createEntries('Comment', content))).toBe('swarmui');
  });

  it('should detect ComfyUI from Version: ComfyUI', () => {
    const content = 'Steps: 20, Version: ComfyUI';
    expect(detectSoftware(createEntries('Comment', content))).toBe('comfyui');
  });

  it('should detect NovelAI from v4_prompt', () => {
    const content = '{"prompt": "test", "v4_prompt": {}}';
    expect(detectSoftware(createEntries('Comment', content))).toBe('novelai');
  });

  it('should detect NovelAI from noise_schedule', () => {
    const content = '{"prompt": "test", "noise_schedule": "karras"}';
    expect(detectSoftware(createEntries('Comment', content))).toBe('novelai');
  });
});
