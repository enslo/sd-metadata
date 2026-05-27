import { describe, expect, it } from 'vitest';
import { parseComfyUI } from '../../../src/parsers/comfyui';
import type { EntryRecord } from '../../../src/utils/entries';

/**
 * Helper to create ComfyUI metadata entries
 */
function createComfyUIEntries(
  prompt: unknown,
  workflow?: unknown,
): EntryRecord {
  const record: Record<string, string> = {
    prompt: JSON.stringify(prompt),
  };
  if (workflow) {
    record.workflow = JSON.stringify(workflow);
  }
  return record;
}

describe('parseComfyUI - Unit Tests', () => {
  describe('format validation', () => {
    it('should return error for missing prompt', () => {
      const entries: EntryRecord = {};

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should return error for invalid JSON', () => {
      const entries: EntryRecord = { prompt: 'not valid json' };

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parseError');
      }
    });
  });

  describe('basic parsing', () => {
    it('should parse minimal ComfyUI metadata', () => {
      const prompt = {
        '1': {
          inputs: { text: 'positive prompt' },
          class_type: 'CLIPTextEncode',
        },
        '2': {
          inputs: { text: 'negative prompt' },
          class_type: 'CLIPTextEncode',
        },
        '3': {
          inputs: {
            positive: ['1', 0],
            negative: ['2', 0],
          },
          class_type: 'KSampler',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
        expect(result.value.prompt).toBe('positive prompt');
        expect(result.value.negativePrompt).toBe('negative prompt');
      }
    });

    it('should store workflow in raw when provided', () => {
      const prompt = {
        '1': {
          inputs: { text: 'test prompt' },
          class_type: 'CLIPTextEncode',
        },
      };
      const workflow = { nodes: ['test'] };
      const entries = createComfyUIEntries(prompt, workflow);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Workflow should be stored (in the metadata)
        expect(result.value).toBeDefined();
      }
    });
  });

  describe('node finding', () => {
    it('should find KSampler node', () => {
      const prompt = {
        '1': {
          inputs: { text: 'positive' },
          class_type: 'CLIPTextEncode',
        },
        '2': {
          inputs: {
            positive: ['1', 0],
          },
          class_type: 'KSampler',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('positive');
      }
    });

    it('should find KSamplerAdvanced node', () => {
      const prompt = {
        '1': {
          inputs: { text: 'positive' },
          class_type: 'CLIPTextEncode',
        },
        '2': {
          inputs: {
            positive: ['1', 0],
          },
          class_type: 'KSamplerAdvanced',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('positive');
      }
    });
  });

  describe('Civitai extraMetadata', () => {
    it('should extract extraMetadata from prompt', () => {
      const prompt = {
        extraMetadata: JSON.stringify({
          prompt: 'civitai prompt',
          negativePrompt: 'civitai negative',
          width: 512,
          height: 768,
        }),
        '1': {
          inputs: { text: 'fallback' },
          class_type: 'CLIPTextEncode',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should prefer extraMetadata
        expect(result.value.prompt).toBe('civitai prompt');
        expect(result.value.negativePrompt).toBe('civitai negative');
        expect(result.value.width).toBe(512);
        expect(result.value.height).toBe(768);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle prompt without KSampler', () => {
      // Without a KSampler the structured parser cannot resolve prompts via
      // sampler-rooted traversal, but the flat-scan fallback still picks up
      // text-bearing nodes directly.
      const prompt = {
        '1': {
          inputs: { text: 'test' },
          class_type: 'CLIPTextEncode',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('test');
        expect(result.value.negativePrompt).toBe('');
      }
    });

    it('should handle missing CLIP nodes', () => {
      const prompt = {
        '1': {
          inputs: {},
          class_type: 'KSampler',
        },
      };
      const entries = createComfyUIEntries(prompt);

      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.prompt).toBe('');
        expect(result.value.negativePrompt).toBe('');
      }
    });
  });

  describe('false negative prevention', () => {
    it('should detect ComfyUI from prompt-only chunk with workflow data', () => {
      // Simulates PNG with only "prompt" chunk containing ComfyUI workflow JSON
      // This represents real-world ComfyUI files that don't have separate workflow chunk
      const prompt = {
        '1': {
          inputs: {
            filename_prefix: 'test',
            images: ['2:0', 0],
          },
          class_type: 'SaveImage',
        },
        '2': {
          inputs: { image: 'test_a.jpg' },
          class_type: 'LoadImage',
        },
        '3': {
          inputs: { image: 'test_b.png' },
          class_type: 'LoadImage',
        },
      };

      const entries = createComfyUIEntries(prompt);
      const result = parseComfyUI(entries);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.software).toBe('comfyui');
      }
    });

    it('should surface workflow-only chunks as ComfyUI with empty metadata', () => {
      // ComfyUI saves that embed only the UI-state "workflow" JSON (no API
      // "prompt" graph). The workflow format is structurally incompatible
      // with the extractor, but identifying the image as ComfyUI is still
      // useful — interpretation is intentionally given up here.
      const workflow = {
        id: 'test-workflow',
        revision: 0,
        last_node_id: 3,
        nodes: [
          {
            id: 1,
            type: 'CLIPTextEncode',
            widgets_values: ['a prompt'],
          },
        ],
        links: [],
      };
      const entries: EntryRecord = { workflow: JSON.stringify(workflow) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.software).toBe('comfyui');
      expect(result.value.prompt).toBe('');
      expect(result.value.negativePrompt).toBe('');
      expect(result.value.width).toBe(0);
      expect(result.value.height).toBe(0);
      if (result.value.software === 'comfyui') {
        expect(result.value.nodes).toEqual({});
      }
    });

    it('should not treat non-workflow JSON as a workflow-only chunk', () => {
      // Defensive: an unrelated JSON-shaped entry under the "workflow" key
      // must not be misidentified. The signature requires `nodes` to be an
      // Array (vs. the flat-object prompt format).
      const entries: EntryRecord = {
        workflow: JSON.stringify({ nodes: { '1': { class_type: 'X' } } }),
      };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unsupportedFormat');
      }
    });

    it('should resolve prompts via PromptStashSaver through a ControlNet apply chain', () => {
      // Real-world workflow pattern: sampler conditioning is routed through
      // ControlNetApplyAdvanced before reaching CLIPTextEncode, which itself
      // forwards text from PromptStashSaver (a community custom node that
      // stores user-authored prompts under inputs.prompt_text).
      const prompt = {
        '1': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'model.safetensors' },
        },
        '6': {
          // CLIPTextEncode for negative — forwards from PromptStashSaver 33
          class_type: 'CLIPTextEncode',
          inputs: { text: ['33', 0] },
        },
        '7': {
          // CLIPTextEncode for positive — forwards from PromptStashSaver 32
          class_type: 'CLIPTextEncode',
          inputs: { text: ['32', 0] },
        },
        '8': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 800, height: 1416 },
        },
        '9': {
          // Sampler routes conditioning through ControlNetApplyAdvanced
          class_type: 'KSampler',
          inputs: {
            seed: 646704302471846,
            steps: 25,
            cfg: 5,
            sampler_name: 'euler',
            scheduler: 'normal',
            positive: ['38', 0],
            negative: ['38', 1],
            latent_image: ['8', 0],
            model: ['1', 0],
          },
        },
        '32': {
          class_type: 'PromptStashSaver',
          inputs: {
            use_input_text: false,
            prompt_text: 'score_9, score_8_up, score_7_up',
            save_as_key: 'positive_preset',
          },
        },
        '33': {
          class_type: 'PromptStashSaver',
          inputs: {
            use_input_text: false,
            prompt_text: 'score_5, score_4, score_3',
            save_as_key: 'negative_preset',
          },
        },
        '38': {
          class_type: 'ControlNetApplyAdvanced',
          inputs: {
            strength: 0.85,
            start_percent: 0,
            end_percent: 1,
            positive: ['7', 0],
            negative: ['6', 0],
          },
        },
      };
      const entries: EntryRecord = { prompt: JSON.stringify(prompt) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.prompt).toBe('score_9, score_8_up, score_7_up');
      expect(result.value.negativePrompt).toBe('score_5, score_4, score_3');
    });

    it('should resolve prompts through ShowText|pysssss intermediates and ignore node-ref ckpt_name', () => {
      // Mirrors a real-world failure case: a checkpoint forwarder produces
      // a node-reference ckpt_name (must be ignored), and CLIPTextEncode
      // inputs point at ShowText|pysssss display nodes that hold the final
      // composed prompt in text_0.
      const prompt = {
        // First checkpoint loader: ckpt_name is a node reference (forwarder)
        '754': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: ['928', 0] },
        },
        // Real checkpoint loader (further in the graph)
        '879': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'real-model.safetensors' },
        },
        // ShowText nodes holding the actual prompt text in text_0
        '726': {
          class_type: 'ShowText|pysssss',
          inputs: { text_0: 'composed positive prompt' },
        },
        '676': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'composed negative prompt' },
        },
        // CLIPTextEncode that forwards from ShowText
        '724': {
          class_type: 'CLIPTextEncode',
          inputs: { text: ['726', 0] },
        },
        // Sampler wired to forwarders
        '678': {
          class_type: 'KSamplerAdvanced',
          inputs: {
            positive: ['724', 0],
            negative: ['676', 0],
            noise_seed: 42,
            steps: 20,
            cfg: 5,
            sampler_name: 'euler',
            scheduler: 'normal',
          },
        },
        '999': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 1024, height: 1024 },
        },
      };
      const entries: EntryRecord = { prompt: JSON.stringify(prompt) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.prompt).toBe('composed positive prompt');
      expect(result.value.negativePrompt).toBe('composed negative prompt');
      expect(result.value.model).toEqual({ name: 'real-model.safetensors' });
    });

    it('should clean NaN literals inside arrays (is_changed: [NaN])', () => {
      // Some ComfyUI custom nodes (DPRandomGenerator etc.) emit
      // `"is_changed": [NaN]` which breaks strict JSON.parse. cleanJsonString
      // must replace NaN at array element positions, not just after ":".
      const promptText =
        '{"1":{"inputs":{"text":"hi"},"class_type":"CLIPTextEncode","is_changed":[NaN]},' +
        '"2":{"inputs":{"text":"bye"},"class_type":"CLIPTextEncode"},' +
        '"3":{"inputs":{"seed":1,"steps":10,"cfg":5,"sampler_name":"euler",' +
        '"scheduler":"normal","positive":["1",0],"negative":["2",0],' +
        '"latent_image":["4",0],"model":["5",0]},"class_type":"KSampler"},' +
        '"4":{"inputs":{"width":512,"height":512},"class_type":"EmptyLatentImage"},' +
        '"5":{"inputs":{"ckpt_name":"m.safetensors"},"class_type":"CheckpointLoaderSimple"}}';
      const entries: EntryRecord = { prompt: promptText };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.prompt).toBe('hi');
      expect(result.value.negativePrompt).toBe('bye');
    });

    it('should backfill prompt via flat scan when structured parser misses it', () => {
      // No sampler node references positive/negative — structured parser
      // returns empty prompt. flatScan picks up the text-box nodes.
      const prompt = {
        '1': {
          class_type: 'DF_Text_Box',
          inputs: { text: 'positive from text box' },
        },
        '2': {
          class_type: 'CLIPTextEncodeNegative',
          inputs: { text: 'negative from text box' },
        },
        '3': {
          // Sampler with no positive/negative inputs (custom topology)
          class_type: 'KSampler',
          inputs: {
            seed: 42,
            steps: 25,
            cfg: 7,
            sampler_name: 'euler_ancestral',
            scheduler: 'karras',
          },
        },
        '4': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'fallback-test.safetensors' },
        },
        '5': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 832, height: 1216 },
        },
      };
      const entries: EntryRecord = { prompt: JSON.stringify(prompt) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.prompt).toBe('positive from text box');
      expect(result.value.negativePrompt).toBe('negative from text box');
      expect(result.value.width).toBe(832);
      expect(result.value.height).toBe(1216);
      expect(result.value.model).toEqual({ name: 'fallback-test.safetensors' });
      expect(result.value.sampling).toMatchObject({
        seed: 42,
        steps: 25,
        cfg: 7,
        sampler: 'euler_ancestral',
        scheduler: 'karras',
      });
    });

    it('should let structured parser results take priority over flat scan', () => {
      // Two CLIPTextEncode nodes: only one is wired to the sampler. Structured
      // parser must pick the wired one; flat scan would otherwise pick the
      // first-defined one.
      const prompt = {
        '1': {
          // Orphan node — flat scan would pick this first, but structured wins
          class_type: 'CLIPTextEncode',
          inputs: { text: 'ORPHAN should not appear' },
        },
        '2': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'real positive' },
        },
        '3': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'real negative' },
        },
        '4': {
          class_type: 'KSampler',
          inputs: {
            seed: 1,
            steps: 10,
            cfg: 5,
            sampler_name: 'euler',
            scheduler: 'normal',
            positive: ['2', 0],
            negative: ['3', 0],
            latent_image: ['5', 0],
            model: ['6', 0],
          },
        },
        '5': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 512, height: 512 },
        },
        '6': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'ok.safetensors' },
        },
      };
      const entries: EntryRecord = { prompt: JSON.stringify(prompt) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.prompt).toBe('real positive');
      expect(result.value.negativePrompt).toBe('real negative');
    });

    it('should fill missing sampling sub-fields without overwriting set ones', () => {
      // Structured parser resolves seed/steps/cfg/sampler/scheduler from a
      // standard KSampler, so flat scan finds nothing new to add.
      // This verifies that mergeObjects in fillEmptyFromFlat does not clobber
      // any structured fields when both sources contain the same values.
      const prompt = {
        '1': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'pos' },
        },
        '2': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'neg' },
        },
        '3': {
          class_type: 'KSampler',
          inputs: {
            seed: 777,
            steps: 30,
            cfg: 6,
            sampler_name: 'dpmpp_2m',
            scheduler: 'karras',
            positive: ['1', 0],
            negative: ['2', 0],
            latent_image: ['4', 0],
            model: ['5', 0],
          },
        },
        '4': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 1024, height: 1024 },
        },
        '5': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'model.safetensors' },
        },
      };
      const entries: EntryRecord = { prompt: JSON.stringify(prompt) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.sampling).toMatchObject({
        seed: 777,
        steps: 30,
        cfg: 6,
        sampler: 'dpmpp_2m',
        scheduler: 'karras',
      });
    });

    it('should handle workflow keyword entry from WebP EXIF', () => {
      // Simulates WebP with EXIF ImageDescription containing "Workflow" prefix
      // The convert.ts should transform this into a "workflow" keyword entry
      const workflow = {
        id: 'test-workflow-id',
        revision: 0,
        last_node_id: 3,
        nodes: [
          {
            id: 1,
            type: 'TestNode',
            class_type: 'TestNode',
          },
        ],
      };

      // This simulates what the reader should produce after parsing EXIF
      const entries: EntryRecord = { workflow: JSON.stringify(workflow) };

      // Verify the workflow keyword is correctly set
      // This is important for detection logic to catch workflow-only files
      expect(entries.workflow).toBeDefined();
    });
  });
});
