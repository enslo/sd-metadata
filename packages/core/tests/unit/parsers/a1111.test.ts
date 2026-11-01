import { describe, expect, it } from 'vitest';
import { parseA1111 } from '../../../src/parsers/a1111';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create A1111 parameters entry
 */
function createA1111Entry(parameters: string): EntryRecord {
  return { parameters };
}

describe('parseA1111 - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing parameters', () => {
      const entries: EntryRecord = {};

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should handle missing Size with 0x0 fallback', () => {
      // Aligned with SD Prompt Reader: Size is optional, defaults to "0x0"
      const parameters = `test prompt
Steps: 20`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test prompt');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal A1111 metadata', () => {
      const parameters = `a beautiful landscape
Steps: 20, Size: 512x768`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('sd-webui');
        expect(result.value.prompt).toBe('a beautiful landscape');
        expect(result.value.negativePrompt).toBe('');
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });

    it('should parse with negative prompt', () => {
      const parameters = `positive prompt
Negative prompt: lowres, bad quality
Steps: 20, Size: 512x512`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('positive prompt');
        expect(result.value.negativePrompt).toBe('lowres, bad quality');
      }
    });

    it('should extract sampling settings', () => {
      const parameters = `test
Steps: 28, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7.5, Seed: 123456, Size: 512x512, Clip skip: 2`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling).toMatchObject({
          steps: 28,
          sampler: 'Euler a',
          scheduler: 'Automatic',
          cfg: 7.5,
          seed: '123456',
          clipSkip: 2,
        });
      }
    });

    it('should extract model settings', () => {
      const parameters = `test
Steps: 20, Size: 512x512, Model: test-model-v1, Model hash: abc123def`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.model).toMatchObject({
          name: 'test-model-v1',
          hash: 'abc123def',
        });
      }
    });

    it('should extract hires settings', () => {
      const parameters = `test
Steps: 20, Size: 512x512, Hires upscale: 2, Hires upscaler: Latent, Hires steps: 10, Denoising strength: 0.5`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hires).toMatchObject({
          scale: 2,
          upscaler: 'Latent',
          steps: 10,
          denoise: 0.5,
        });
      }
    });
  });

  describe('software pass-through', () => {
    it('should use the provided software value', () => {
      const parameters = `test
Steps: 20, Size: 512x512`;
      const entries = createA1111Entry(parameters);

      const variants = [
        'sd-webui',
        'sd-next',
        'forge',
        'forge-classic',
        'forge-neo',
        'reforge',
        'easy-reforge',
        'civitai',
      ] as const;

      for (const software of variants) {
        const result = parseA1111(entries, software);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.software).toBe(software);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle prompt with commas', () => {
      const parameters = `test, test, test
Steps: 20, Size: 512x512`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test, test, test');
      }
    });

    it('should handle parsing with complex settings', () => {
      // Model names with commas get split by the parser - this is a known limitation
      const parameters = `test
Steps: 20, Size: 512x512, Model: model-v1, Sampler: Euler a`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Parser will extract multiple key-values
        expect(result.value.sampling?.sampler).toBe('Euler a');
      }
    });

    it('should handle JPEG UserComment entry', () => {
      const parameters = `test
Steps: 20, Size: 512x512`;
      const entries: EntryRecord = { UserComment: parameters };

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
      }
    });

    it('should handle negative prompt without settings section', () => {
      // Has negative prompt but no "Steps:"
      const parameters = `positive
Negative prompt: negative`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'sd-webui');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('positive');
        expect(result.value.negativePrompt).toBe('negative');
        expect(result.value.width).toBe(0);
        expect(result.value.height).toBe(0);
      }
    });

    it('should keep a 64-bit seed exact instead of rounding it to a number', () => {
      // Fooocus (a1111 scheme) writes 64-bit seeds that exceed 2^53
      const parameters = `test
Steps: 30, Sampler: DPM++ 2M SDE Karras, Seed: 4575475577937763433, Version: Fooocus v2.5.5`;
      const entries = createA1111Entry(parameters);

      const result = parseA1111(entries, 'fooocus');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sampling?.seed).toBe('4575475577937763433');
      }
    });
  });
});

describe('parseA1111 - settings values', () => {
  it('should unquote quoted values and keep their commas', () => {
    const parameters = `test
Steps: 20, Lora hashes: "LECO_GoodHands: fe3806374a03, LECO_BadHands: 37c8880f409c", Version: classic`;

    const result = parseA1111(createA1111Entry(parameters), 'forge-classic');

    expect(result.ok).toBe(true);
    // The quoted list must not leak its inner "name: hash" pairs as settings keys:
    // Version still follows, and no LoRA is invented from the hashes alone
    if (result.ok) {
      expect(result.value.sampling?.steps).toBe(20);
      expect(result.value.loras).toBeUndefined();
    }
  });

  it('should keep JSON arrays and objects as one value', () => {
    const parameters = `test
Steps: 20, Hashes: {"model": "f116b0c78f", "lora:a": "59d5706a66"}, Civitai resources: [{"type":"checkpoint","modelName":"x"}], Clip skip: 2`;

    const result = parseA1111(createA1111Entry(parameters), 'sd-webui');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sampling?.clipSkip).toBe(2);
      expect(result.value.loras).toBeUndefined();
    }
  });

  it('should skip text that is not a key and continue', () => {
    const parameters = `test
Steps: 20, garbage without colon, Seed: 42`;

    const result = parseA1111(createA1111Entry(parameters), 'sd-webui');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sampling?.seed).toBe('42');
    }
  });
});

describe('parseA1111 - SD.Next templates', () => {
  it('should drop the Template and Negative template echo', () => {
    // processing_info.py appends them between the negative prompt and the settings
    const parameters = `1girl <lora:a:0.5>
Negative prompt: lowres
Template: 1girl <lora:a:0.5>
Negative template: lowres
Steps: 20, Sampler: Default, Seed: 1`;

    const result = parseA1111(createA1111Entry(parameters), 'sd-next');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompt).toBe('1girl <lora:a:0.5>');
      expect(result.value.negativePrompt).toBe('lowres');
      expect(result.value.loras).toEqual([{ name: 'a', weight: 0.5 }]);
    }
  });

  it('should drop the template when there is no negative prompt', () => {
    const parameters = `1girl
Template: 1girl
Steps: 20`;

    const result = parseA1111(createA1111Entry(parameters), 'sd-next');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompt).toBe('1girl');
      expect(result.value.negativePrompt).toBe('');
    }
  });
});

describe('parseA1111 - LoRA extraction', () => {
  it('should read tags from the positive prompt and hashes from Lora hashes', () => {
    const parameters = `1girl <lora:LECO_GoodHands:-0.8> <lora:Smooth_Booster_v5:0.1:0.5>
Negative prompt: lowres <lora:negative_only:1>
Steps: 20, Lora hashes: "LECO_GoodHands: fe3806374a03, Smooth_Booster_v5: c121dd957230"`;

    const result = parseA1111(createA1111Entry(parameters), 'forge-classic');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The tag in the negative prompt is not applied by A1111 and is ignored
      expect(result.value.loras).toEqual([
        { name: 'LECO_GoodHands', weight: -0.8, hash: 'fe3806374a03' },
        {
          name: 'Smooth_Booster_v5',
          weight: 0.5,
          clipWeight: 0.1,
          hash: 'c121dd957230',
        },
      ]);
    }
  });

  it('should read the Fooocus a1111 scheme from Lora weights and Lora hashes', () => {
    const parameters = `test
Steps: 30, Lora hashes: "LECO_GoodHands: ba19c53aee, LECO_BadHands: d63dde547c", Lora weights: "LECO_GoodHands: -0.38, LECO_BadHands: 0.33", Version: Fooocus v2.5.5`;

    const result = parseA1111(createA1111Entry(parameters), 'fooocus');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        { name: 'LECO_GoodHands', weight: -0.38, hash: 'ba19c53aee' },
        { name: 'LECO_BadHands', weight: 0.33, hash: 'd63dde547c' },
      ]);
    }
  });

  it('should read the Lora_N keys of ComfyUI-SaveImageWithMetaData', () => {
    const parameters = `test
Steps: 20, Lora_0 Model name: a.safetensors, Lora_0 Model hash: 59d5706a66, Lora_0 Strength model: 0.4, Lora_0 Strength clip: 0.2, Lora_1 Model name: b.safetensors, Lora_1 Model hash: 4c0259af91, Lora_1 Strength model: 0.9, Lora_1 Strength clip: 0.8, Hashes: {"model": "f116b0c78f", "lora:a": "59d5706a66"}`;

    const result = parseA1111(createA1111Entry(parameters), 'sd-webui');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        {
          name: 'a.safetensors',
          weight: 0.4,
          clipWeight: 0.2,
          hash: '59d5706a66',
        },
        {
          name: 'b.safetensors',
          weight: 0.9,
          clipWeight: 0.8,
          hash: '4c0259af91',
        },
      ]);
    }
  });

  it('should read the LoRA entries of Civitai resources', () => {
    const parameters = `test
Steps: 20, Civitai resources: [{"type":"checkpoint","modelVersionId":1,"modelName":"ckpt"},{"type":"lora","weight":0.95,"modelVersionId":2,"modelName":"Hands XL \\u002B ZIB"},{"type":"lora","weight":0.4,"modelVersionId":3,"modelName":"Detailed"}], Civitai metadata: {"resources":[{"modelVersionId":2,"strength":0.95,"type":"LORA"}]}`;

    const result = parseA1111(createA1111Entry(parameters), 'civitai');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        { name: 'Hands XL + ZIB', weight: 0.95 },
        { name: 'Detailed', weight: 0.4 },
      ]);
    }
  });

  it('should omit loras when the text has none', () => {
    const parameters = `test
Steps: 20, Size: 512x512`;

    const result = parseA1111(createA1111Entry(parameters), 'sd-webui');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toBeUndefined();
      expect('loras' in result.value).toBe(false);
    }
  });
});
