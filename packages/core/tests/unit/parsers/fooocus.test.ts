import { describe, expect, it } from 'vitest';
import { parseFooocus } from '../../../src/parsers/fooocus';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create Fooocus JSON metadata entry
 *
 * Fooocus stores metadata in the `parameters` chunk (PNG) or
 * `UserComment` EXIF tag (JPEG/WebP).
 */
function createFooocusEntry(metadata: unknown): EntryRecord {
  return { parameters: JSON.stringify(metadata) };
}

describe('parseFooocus - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: EntryRecord = {};

      const result = parseFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for non-JSON parameters', () => {
      const entries: EntryRecord = { parameters: 'plain text' };

      const result = parseFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: EntryRecord = { parameters: '{invalid json}' };

      const result = parseFooocus(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });

    it('should read from UserComment when parameters is missing', () => {
      const metadata = {
        prompt: 'a landscape',
        negative_prompt: 'lowres',
        resolution: '(512, 768)',
      };
      const entries: EntryRecord = {
        UserComment: JSON.stringify(metadata),
      };

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('fooocus');
        expect(result.value.prompt).toBe('a landscape');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal Fooocus metadata', () => {
      const metadata = {
        prompt: 'a beautiful landscape',
        negative_prompt: 'lowres, bad quality',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('fooocus');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should parse resolution string into width and height', () => {
      const metadata = {
        prompt: 'test',
        resolution: '(1024, 1024)',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(1024);
        expect(result.value.height).toBe(1024);
      }
    });

    it('should parse non-square resolution string', () => {
      const metadata = {
        prompt: 'test',
        resolution: '(896, 1152)',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(896);
        expect(result.value.height).toBe(1152);
      }
    });
  });

  describe('model and sampling settings', () => {
    it('should extract model settings', () => {
      const metadata = {
        prompt: 'test',
        base_model: 'juggernautXL_v8Rundiffusion.safetensors',
        base_model_hash: 'aeb7c9a6261c',
        vae: 'sdxl_vae.safetensors',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'juggernautXL_v8Rundiffusion.safetensors',
          hash: 'aeb7c9a6261c',
          vae: 'sdxl_vae.safetensors',
        });
      }
    });

    it('should extract sampling settings with guidance_scale as cfg', () => {
      const metadata = {
        prompt: 'test',
        seed: 123456,
        steps: 30,
        guidance_scale: 7.0,
        sampler: 'dpmpp_2m_sde_gpu',
        scheduler: 'karras',
        clip_skip: 2,
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          seed: '123456',
          steps: 30,
          cfg: 7.0,
          sampler: 'dpmpp_2m_sde_gpu',
          scheduler: 'karras',
          clipSkip: 2,
        });
      }
    });
  });

  describe('resolved prompts', () => {
    it('should join full_prompt and full_negative_prompt like the a1111 scheme', () => {
      // Styles wrap the first prompt line; later lines and the expansion follow
      const metadata = {
        prompt: 'quality tags\n1girl',
        negative_prompt: 'lowres',
        full_prompt: [
          'watercolor painting quality tags . painterly',
          '1girl',
          'quality tags, very detailed',
        ],
        full_negative_prompt: ['anime, photorealistic', 'lowres'],
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe(
          'watercolor painting quality tags . painterly, 1girl, quality tags, very detailed',
        );
        expect(result.value.negativePrompt).toBe(
          'anime, photorealistic, lowres',
        );
      }
    });

    it('should fall back to the raw prompts when the resolved lists are missing', () => {
      const metadata = {
        prompt: 'raw prompt',
        negative_prompt: 'raw negative',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('raw prompt');
        expect(result.value.negativePrompt).toBe('raw negative');
      }
    });

    it('should fall back to the raw prompts when the resolved lists are empty', () => {
      const metadata = {
        prompt: 'raw prompt',
        negative_prompt: 'raw negative',
        full_prompt: [],
        full_negative_prompt: ['', '   '],
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('raw prompt');
        expect(result.value.negativePrompt).toBe('raw negative');
      }
    });

    it('should skip non-string and blank entries in the resolved lists', () => {
      const metadata = {
        prompt: 'raw',
        full_prompt: ['a', '', 42, null, 'b'],
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('a, b');
      }
    });
  });

  describe('edge cases', () => {
    it('should trim prompt whitespace', () => {
      const metadata = {
        prompt: '  test prompt  ',
        negative_prompt: '  negative  ',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test prompt');
        expect(result.value.negativePrompt).toBe('negative');
      }
    });

    it('should handle missing prompts', () => {
      const metadata = {
        resolution: '(1024, 1024)',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });

    it('should handle missing resolution', () => {
      const metadata = {
        prompt: 'test',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });

    it('should handle malformed resolution string', () => {
      const metadata = {
        prompt: 'test',
        resolution: 'invalid',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });

    it('should handle missing optional model and sampling fields', () => {
      const metadata = {
        prompt: 'test',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Model and sampling should still be defined but with undefined fields
        expect(result.value.model?.name).toBeUndefined();
        expect(result.value.sampling?.seed).toBeUndefined();
      }
    });

    it('should keep the 64-bit seed string written by Fooocus exact', () => {
      // Fooocus serializes the seed as a JSON string because it exceeds 2^53
      const metadata = {
        prompt: 'test',
        seed: '7100816951239959675',
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling?.seed).toBe('7100816951239959675');
      }
    });

    it('should stringify a numeric seed from older Fooocus builds', () => {
      const metadata = {
        prompt: 'test',
        seed: 123456,
      };
      const entries = createFooocusEntry(metadata);

      const result = parseFooocus(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling?.seed).toBe('123456');
      }
    });
  });
});

describe('parseFooocus - LoRA extraction', () => {
  it('should read the [name, weight, hash] entries of loras', () => {
    const entries = createFooocusEntry({
      prompt: 'test',
      loras: [
        ['LECO_GoodHands', -0.48, 'ba19c53aee'],
        ['LECO_BadHands', 0.77],
      ],
      lora_combined_1: 'LECO_GoodHands : -0.48',
      lora_combined_2: 'LECO_BadHands : 0.77',
    });

    const result = parseFooocus(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        { name: 'LECO_GoodHands', weight: -0.48, hash: 'ba19c53aee' },
        { name: 'LECO_BadHands', weight: 0.77 },
      ]);
    }
  });

  it('should skip malformed entries and omit loras when none remain', () => {
    const entries = createFooocusEntry({
      prompt: 'test',
      loras: ['LECO_GoodHands', [], ['None', 0.5, 'ba19c53aee'], [42, 0.5]],
      lora_combined_1: 'LECO_GoodHands : -0.48',
    });

    const result = parseFooocus(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty('loras');
    }
  });
});
