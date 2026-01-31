import { describe, expect, it } from 'vitest';
import { detectSoftware } from '../../../src/parsers/detect';
import type { MetadataEntry } from '../../../src/types';

describe('detectSoftware - Unit Tests', () => {
  describe('ComfyUI detection', () => {
    describe('from prompt and workflow keywords', () => {
      it('should detect ComfyUI when both prompt and workflow exist', () => {
        const entries: MetadataEntry[] = [
          { keyword: 'prompt', text: '{"1": {"class_type": "TestNode"}}' },
          { keyword: 'workflow', text: '{"nodes": []}' },
        ];

        const result = detectSoftware(entries);

        expect(result).toBe('comfyui');
      });

      it('should detect ComfyUI from workflow keyword only', () => {
        const entries: MetadataEntry[] = [
          { keyword: 'workflow', text: '{"nodes": []}' },
        ];

        const result = detectSoftware(entries);

        expect(result).toBe('comfyui');
      });
    });

    describe('from prompt-only chunks with ComfyUI workflow data', () => {
      it('should detect ComfyUI from prompt chunk containing class_type', () => {
        // Simulates PNG with only "prompt" chunk containing ComfyUI workflow JSON
        const prompt = JSON.stringify({
          '1': {
            inputs: { filename_prefix: 'test' },
            class_type: 'SaveImage',
          },
          '2': {
            inputs: { image: 'test.jpg' },
            class_type: 'LoadImage',
          },
        });

        const entries: MetadataEntry[] = [{ keyword: 'prompt', text: prompt }];

        const result = detectSoftware(entries);

        expect(result).toBe('comfyui');
      });

      it('should detect ComfyUI from prompt chunk with nodes structure', () => {
        const prompt = JSON.stringify({
          '1': {
            class_type: 'KSampler',
            inputs: {},
          },
        });

        const entries: MetadataEntry[] = [{ keyword: 'prompt', text: prompt }];

        const result = detectSoftware(entries);

        expect(result).toBe('comfyui');
      });
    });

    describe('from UserComment entry (JPEG/WebP)', () => {
      it('should detect ComfyUI from UserComment with prompt and workflow JSON', () => {
        const comment = JSON.stringify({
          prompt: '{"1": {"class_type": "TestNode"}}',
          workflow: '{"nodes": []}',
        });

        const entries: MetadataEntry[] = [
          { keyword: 'UserComment', text: comment },
        ];

        const result = detectSoftware(entries);

        expect(result).toBe('comfyui');
      });
    });
  });

  describe('A1111 detection', () => {
    it('should detect sd-webui from Steps and Sampler keywords', () => {
      const parameters = 'test prompt\nSteps: 20, Sampler: Euler a';
      const entries: MetadataEntry[] = [
        { keyword: 'parameters', text: parameters },
      ];

      const result = detectSoftware(entries);

      expect(result).toBe('sd-webui');
    });

    it('should not detect non-AI metadata as sd-webui', () => {
      // This should return null, not 'sd-webui'
      const entries: MetadataEntry[] = [
        { keyword: 'Comment', text: 'Photo Editor Pro v2.0' },
      ];

      const result = detectSoftware(entries);

      // After implementation, this should be null
      // Currently it might be detected as sd-webui (false positive)
      expect(result).not.toBe('sd-webui');
    });
  });

  describe('edge cases', () => {
    it('should return null for empty entries', () => {
      const entries: MetadataEntry[] = [];

      const result = detectSoftware(entries);

      expect(result).toBe(null);
    });

    it('should return null for unrecognized metadata', () => {
      const entries: MetadataEntry[] = [
        { keyword: 'unknown', text: 'some data' },
      ];

      const result = detectSoftware(entries);

      expect(result).toBe(null);
    });
  });
});
