import { describe, expect, it } from 'vitest';
import { detectSoftware } from '../../../src/parsers/detect';
import type { EntryRecord } from '../../../src/utils/entries';

describe('detectSoftware - Unit Tests', () => {
  describe('ComfyUI detection', () => {
    describe('from prompt and workflow keywords', () => {
      it('should detect ComfyUI when both prompt and workflow exist', () => {
        const entries: EntryRecord = {
          prompt: '{"1": {"class_type": "TestNode"}}',
          workflow: '{"nodes": []}',
        };

        const result = detectSoftware(entries);

        expect(result).toBe('comfyui');
      });

      it('should detect ComfyUI from workflow keyword only', () => {
        const entries: EntryRecord = {
          workflow: '{"nodes": []}',
        };

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

        const entries: EntryRecord = { prompt };

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

        const entries: EntryRecord = { prompt };

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

        const entries: EntryRecord = { UserComment: comment };

        const result = detectSoftware(entries);

        expect(result).toBe('comfyui');
      });
    });
  });

  describe('A1111 detection', () => {
    it('should detect sd-webui from Steps and Sampler keywords', () => {
      const parameters = 'test prompt\nSteps: 20, Sampler: Euler a';
      const entries: EntryRecord = { parameters };

      const result = detectSoftware(entries);

      expect(result).toBe('sd-webui');
    });

    it('should not detect non-AI metadata as sd-webui', () => {
      // This should return null, not 'sd-webui'
      const entries: EntryRecord = { Comment: 'Photo Editor Pro v2.0' };

      const result = detectSoftware(entries);

      // After implementation, this should be null
      // Currently it might be detected as sd-webui (false positive)
      expect(result).not.toBe('sd-webui');
    });
  });

  describe('Fooocus detection', () => {
    describe('from fooocus_scheme chunk (PNG Tier 1)', () => {
      it('should detect fooocus when fooocus_scheme chunk exists with "fooocus" value', () => {
        const entries: EntryRecord = {
          parameters: '{"prompt": "test", "base_model": "model.safetensors"}',
          fooocus_scheme: 'fooocus',
        };

        const result = detectSoftware(entries);

        expect(result).toBe('fooocus');
      });

      it('should detect fooocus when fooocus_scheme chunk exists with "a1111" value', () => {
        const entries: EntryRecord = {
          parameters: 'test prompt\nSteps: 20, Sampler: Euler a',
          fooocus_scheme: 'a1111',
        };

        const result = detectSoftware(entries);

        expect(result).toBe('fooocus');
      });
    });

    describe('from Version field in A1111 text (Tier 3)', () => {
      it('should detect fooocus from Version: Fooocus v2.5.5', () => {
        const parameters =
          'test prompt\nNegative prompt: bad\nSteps: 30, Sampler: dpmpp_2m_sde_gpu, CFG scale: 7.0, Seed: 12345, Version: Fooocus v2.5.5';
        const entries: EntryRecord = { parameters };

        const result = detectSoftware(entries);

        expect(result).toBe('fooocus');
      });

      it('should detect fooocus from Version: Fooocus v2.1.0', () => {
        const parameters = 'test prompt\nSteps: 20, Version: Fooocus v2.1.0';
        const entries: EntryRecord = { parameters };

        const result = detectSoftware(entries);

        expect(result).toBe('fooocus');
      });
    });

    describe('from JSON content (Tier 3 fallback)', () => {
      it('should detect fooocus from JSON with prompt + base_model', () => {
        const json = JSON.stringify({
          prompt: 'a beautiful landscape',
          negative_prompt: 'lowres',
          base_model: 'model.safetensors',
          guidance_scale: 7.0,
        });
        const entries: EntryRecord = { parameters: json };

        const result = detectSoftware(entries);

        expect(result).toBe('fooocus');
      });
    });
  });

  describe('edge cases', () => {
    it('should return null for empty entries', () => {
      const entries: EntryRecord = {};

      const result = detectSoftware(entries);

      expect(result).toBe(null);
    });

    it('should return null for unrecognized metadata', () => {
      const entries: EntryRecord = { unknown: 'some data' };

      const result = detectSoftware(entries);

      expect(result).toBe(null);
    });
  });
});
