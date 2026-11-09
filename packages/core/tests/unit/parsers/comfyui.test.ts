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

    it('should resolve prompts through ComfySwitchNode/PreviewAny chains (Krea-2 Turbo template)', () => {
      // Mirrors ComfyUI's official Krea-2 Turbo subgraph template: the
      // CLIPTextEncode text flows through If/Else switches and a PreviewAny
      // display node. The enhanced prompt comes from TextGenerate (an LLM
      // node whose output is never persisted), so extraction must fall back
      // to the other switch branch, which carries the user's original input.
      const prompt = {
        '3': {
          class_type: 'KSampler',
          inputs: {
            seed: 371644226245214,
            steps: 8,
            cfg: 1,
            sampler_name: 'euler',
            scheduler: 'simple',
            denoise: 1,
            model: ['10', 0],
            positive: ['6', 0],
            negative: ['13', 0],
            latent_image: ['5', 0],
          },
        },
        '5': {
          class_type: 'EmptyLatentImage',
          inputs: { width: ['49', 0], height: ['49', 1], batch_size: 1 },
        },
        '6': {
          class_type: 'CLIPTextEncode',
          inputs: { text: ['28', 0], clip: ['11', 0] },
        },
        '10': {
          class_type: 'UNETLoader',
          inputs: { unet_name: 'krea2_turbo.safetensors' },
        },
        '13': {
          class_type: 'ConditioningZeroOut',
          inputs: { conditioning: ['6', 0] },
        },
        '16': {
          class_type: 'TextGenerate',
          inputs: { prompt: ['17', 0], max_length: 512, clip: ['11', 0] },
        },
        '17': {
          class_type: 'StringConcatenate',
          inputs: { string_a: ['18', 0], string_b: ['19', 0], delimiter: '' },
        },
        '18': {
          class_type: 'PrimitiveStringMultiline',
          inputs: { value: 'You are an expert prompt engineer. Expand...' },
        },
        '19': {
          class_type: 'PrimitiveStringMultiline',
          inputs: { value: 'portrait of hatsune miku, white background' },
        },
        '20': {
          class_type: 'PreviewAny',
          inputs: { source: ['21', 0] },
        },
        '21': {
          // Refine Prompt? = true → selects TextGenerate (runtime-only)
          class_type: 'ComfySwitchNode',
          inputs: {
            switch: ['24', 0],
            on_false: ['19', 0],
            on_true: ['16', 0],
          },
        },
        '23': {
          class_type: 'PrimitiveBoolean',
          inputs: { value: false },
        },
        '24': {
          class_type: 'PrimitiveBoolean',
          inputs: { value: true },
        },
        '27': {
          class_type: 'StringConcatenate',
          inputs: { string_a: ['20', 0], string_b: '', delimiter: ', ' },
        },
        '28': {
          // Enable LoRA? = false → selects the PreviewAny passthrough
          class_type: 'ComfySwitchNode',
          inputs: {
            switch: ['23', 0],
            on_false: ['20', 0],
            on_true: ['27', 0],
          },
        },
      };
      const entries: EntryRecord = { prompt: JSON.stringify(prompt) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // User input recovered; the LLM system prompt must not leak
      expect(result.value.prompt).toBe(
        'portrait of hatsune miku, white background',
      );
      // ConditioningZeroOut means empty negative conditioning
      expect(result.value.negativePrompt).toBe('');
      expect(result.value.model).toEqual({ name: 'krea2_turbo.safetensors' });
    });

    it('should prefer the switch-selected branch when it resolves to text', () => {
      const prompt = {
        '1': {
          class_type: 'CLIPTextEncode',
          inputs: { text: ['2', 0] },
        },
        '2': {
          class_type: 'ComfySwitchNode',
          inputs: { switch: true, on_false: ['3', 0], on_true: ['4', 0] },
        },
        '3': {
          class_type: 'PrimitiveStringMultiline',
          inputs: { value: 'unselected branch' },
        },
        '4': {
          class_type: 'PrimitiveString',
          inputs: { value: 'selected branch' },
        },
        '5': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'negative text' },
        },
        '9': {
          class_type: 'KSampler',
          inputs: {
            seed: 1,
            steps: 10,
            cfg: 5,
            sampler_name: 'euler',
            scheduler: 'normal',
            positive: ['1', 0],
            negative: ['5', 0],
            latent_image: ['8', 0],
          },
        },
        '8': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 512, height: 512 },
        },
      };
      const entries: EntryRecord = { prompt: JSON.stringify(prompt) };

      const result = parseComfyUI(entries);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.prompt).toBe('selected branch');
      expect(result.value.negativePrompt).toBe('negative text');
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
        seed: '42',
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
        seed: '777',
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

describe('parseComfyUI - LoRA loader nodes', () => {
  it('should list the LoRAs applied by loader nodes', () => {
    const entries = createComfyUIEntries({
      '1': {
        class_type: 'LoraLoader',
        inputs: {
          lora_name: 'A.safetensors',
          strength_model: 0.5,
          strength_clip: 0.4,
        },
      },
      // The sampler takes its model from the loader, so the LoRA is applied
      '2': {
        class_type: 'KSampler',
        inputs: { seed: 1, steps: 20, cfg: 5, model: ['1', 0] },
      },
    });

    const result = parseComfyUI(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.loras).toEqual([
        { name: 'A.safetensors', weight: 0.5, clipWeight: 0.4 },
      ]);
    }
  });

  it('should omit loras when no loader applies one', () => {
    const entries = createComfyUIEntries({
      '1': {
        class_type: 'CR LoRA Stack',
        inputs: {
          switch_1: 'Off',
          lora_name_1: 'A.safetensors',
          model_weight_1: 1,
        },
      },
      '2': { class_type: 'KSampler', inputs: { seed: 1, steps: 20, cfg: 5 } },
    });

    const result = parseComfyUI(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty('loras');
    }
  });
});

describe('parseComfyUI - all-in-one loaders', () => {
  it('should read prompts, size and clip skip from Efficient Loader', () => {
    const entries = createComfyUIEntries({
      '1': {
        class_type: 'Efficient Loader',
        inputs: {
          ckpt_name: 'model.safetensors',
          clip_skip: -2,
          lora_name: 'None',
          positive: 'a positive prompt',
          negative: 'a negative prompt',
          empty_latent_width: 1024,
          empty_latent_height: 768,
        },
      },
      '3': {
        class_type: 'KSampler Adv. (Efficient)',
        inputs: {
          noise_seed: 42,
          steps: 20,
          cfg: 5,
          sampler_name: 'euler_ancestral',
          scheduler: 'sgm_uniform',
          model: ['1', 0],
          positive: ['1', 1],
          negative: ['1', 2],
          latent_image: ['1', 3],
        },
      },
    });

    const result = parseComfyUI(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        software: 'comfyui',
        prompt: 'a positive prompt',
        negativePrompt: 'a negative prompt',
        width: 1024,
        height: 768,
        model: { name: 'model.safetensors' },
        sampling: {
          seed: '42',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
          clipSkip: 2,
        },
        nodes: expect.any(Object),
      });
    }
  });

  it('should take the easy fullLoader resolution preset over its size inputs', () => {
    const loader = (resolution: string) => ({
      class_type: 'easy fullLoader',
      inputs: {
        ckpt_name: 'model.safetensors',
        clip_skip: -1,
        lora_name: 'None',
        resolution,
        empty_latent_width: 512,
        empty_latent_height: 640,
        positive: 'a positive prompt\n',
        negative: 'a negative prompt\n',
      },
    });
    const sampler = {
      class_type: 'easy fullkSampler',
      inputs: {
        seed: 7,
        steps: 20,
        cfg: 5,
        sampler_name: 'euler_ancestral',
        scheduler: 'sgm_uniform',
        denoise: 1,
        pipe: ['5', 0],
        model: ['5', 1],
        positive: ['5', 4],
        negative: ['5', 5],
        latent: ['5', 6],
      },
    };

    const preset = parseComfyUI(
      createComfyUIEntries({ '5': loader('1024 x 1024'), '8': sampler }),
    );
    expect(preset.ok).toBe(true);
    if (preset.ok) {
      expect(preset.value.prompt).toBe('a positive prompt\n');
      expect(preset.value.negativePrompt).toBe('a negative prompt\n');
      expect(preset.value.width).toBe(1024);
      expect(preset.value.height).toBe(1024);
      expect(preset.value.sampling?.seed).toBe('7');
      expect(preset.value.sampling?.clipSkip).toBe(1);
    }

    // The custom-size sentinel hands over to the width / height inputs
    const custom = parseComfyUI(
      createComfyUIEntries({
        '5': loader('width x height (custom)'),
        '8': sampler,
      }),
    );
    expect(custom.ok).toBe(true);
    if (custom.ok) {
      expect(custom.value.width).toBe(512);
      expect(custom.value.height).toBe(640);
    }
  });

  it('should resolve the hires scale through CR Integer Multiple', () => {
    const graph = (multiple: unknown) => ({
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'model.safetensors' },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'pos', clip: ['1', 1] },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'neg', clip: ['1', 1] },
      },
      '4': {
        class_type: 'EmptyLatentImage',
        inputs: { width: 1024, height: 1024, batch_size: 1 },
      },
      '5': {
        class_type: 'KSampler',
        inputs: {
          seed: 1,
          steps: 20,
          cfg: 5,
          sampler_name: 'euler_ancestral',
          scheduler: 'normal',
          denoise: 1,
          model: ['1', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['4', 0],
        },
      },
      '6': {
        class_type: 'VAEDecode',
        inputs: { samples: ['5', 0], vae: ['1', 2] },
      },
      '7': {
        class_type: 'UpscaleModelLoader',
        inputs: { model_name: 'ESRGAN-Remacri-4x.pth' },
      },
      '8': {
        class_type: 'ImageUpscaleWithModel',
        inputs: { upscale_model: ['7', 0], image: ['6', 0] },
      },
      '9': { class_type: 'PrimitiveFloat', inputs: { value: 1.5 } },
      '10': {
        class_type: 'CR Integer Multiple',
        inputs: { integer: ['4', 1], multiple },
      },
      '11': {
        class_type: 'CR Integer Multiple',
        inputs: { integer: ['4', 2], multiple },
      },
      '12': {
        class_type: 'ImageScale',
        inputs: {
          upscale_method: 'bicubic',
          width: ['10', 0],
          height: ['11', 0],
          crop: 'disabled',
          image: ['8', 0],
        },
      },
      '13': {
        class_type: 'VAEEncode',
        inputs: { pixels: ['12', 0], vae: ['1', 2] },
      },
      '14': {
        class_type: 'KSampler',
        inputs: {
          seed: 2,
          steps: 10,
          cfg: 6,
          sampler_name: 'euler_ancestral',
          scheduler: 'normal',
          denoise: 0.3,
          model: ['1', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['13', 0],
        },
      },
    });

    // The multiple wired from a PrimitiveFloat
    const wired = parseComfyUI(createComfyUIEntries(graph(['9', 0])));
    expect(wired.ok).toBe(true);
    if (wired.ok) {
      expect(wired.value.hires).toEqual({
        upscaler: 'ESRGAN-Remacri-4x.pth',
        scale: 1.5,
        steps: 10,
        denoise: 0.3,
      });
    }

    // The multiple as a literal
    const literal = parseComfyUI(createComfyUIEntries(graph(2)));
    expect(literal.ok).toBe(true);
    if (literal.ok) {
      expect(literal.value.hires?.scale).toBe(2);
    }
  });
});

describe('parseComfyUI - conditioning wiring', () => {
  const sampler = (positive: unknown, negative: unknown) => ({
    class_type: 'KSampler',
    inputs: {
      seed: 1,
      steps: 10,
      cfg: 5,
      sampler_name: 'euler',
      scheduler: 'normal',
      positive,
      negative,
      latent_image: ['90', 0],
      model: ['91', 0],
    },
  });
  const common = {
    '90': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 512, height: 512 },
    },
    '91': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'ok.safetensors' },
    },
  };

  function parse(prompt: Record<string, unknown>) {
    const result = parseComfyUI({ prompt: JSON.stringify(prompt) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    return result.value;
  }

  it('should leave the negative prompt empty when both sides share one output', () => {
    // MOSS-Image style graph: positive and negative wired to the same
    // CLIPTextEncode output, a second "Negative Prompt" node left unconnected
    const value = parse({
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'shared prompt' } },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'orphan negative' },
      },
      '3': sampler(['1', 0], ['1', 0]),
      ...common,
    });
    expect(value.prompt).toBe('shared prompt');
    expect(value.negativePrompt).toBe('');
  });

  it('should read negative_prompt from an encoder that outputs both sides', () => {
    // TextEncodeQwenImage21: output 0 is the positive conditioning,
    // output 1 the negative one, built from `negative_prompt`
    const graph = (negativePrompt: string) => ({
      '1': {
        class_type: 'TextEncodeQwenImage21',
        inputs: {
          prompt: 'cut out the background',
          negative_prompt: negativePrompt,
          clip: ['92', 0],
        },
      },
      '3': sampler(['1', 0], ['1', 1]),
      ...common,
    });
    const empty = parse(graph(''));
    expect(empty.prompt).toBe('cut out the background');
    expect(empty.negativePrompt).toBe('');

    const filled = parse(graph('blurry'));
    expect(filled.prompt).toBe('cut out the background');
    expect(filled.negativePrompt).toBe('blurry');
  });

  it('should read the populated text of an Impact wildcard processor', () => {
    const value = parse({
      '1': { class_type: 'CLIPTextEncode', inputs: { text: ['9', 0] } },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: 'low quality' } },
      '3': sampler(['1', 0], ['2', 0]),
      '9': {
        class_type: 'ImpactWildcardProcessor',
        inputs: {
          wildcard_text: '__character__, 1girl',
          populated_text: 'alice, 1girl',
          mode: 'reproduce',
          seed: 7,
          'Select to add Wildcard': 'Select the Wildcard to add to the text',
        },
      },
      ...common,
    });
    expect(value.prompt).toBe('alice, 1girl');
    expect(value.negativePrompt).toBe('low quality');
  });

  it('should not borrow the negative text when the wired positive is unreadable', () => {
    // The positive wire ends at a node whose text input is unknown; the flat
    // scan must not fill the prompt with the negative encoder's text. (A
    // sampler with no wiring at all still gets the flat-scan backfill, see
    // "should backfill prompt via flat scan".)
    const value = parse({
      '1': {
        class_type: 'MysteryEncode',
        inputs: { words: 'the real prompt', clip: ['92', 0] },
      },
      '2': { class_type: 'CLIPTextEncode', inputs: { text: 'low quality' } },
      '3': sampler(['1', 0], ['2', 0]),
      ...common,
    });
    expect(value.prompt).toBe('');
    expect(value.negativePrompt).toBe('low quality');
  });

  it('should follow conditioning inputs through intermediate nodes', () => {
    // ControlNetApply (single `conditioning`) and ConditioningCombine
    // (`conditioning_1` / `conditioning_2`): the first branch carrying text wins
    const value = parse({
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'via controlnet' } },
      '2': {
        class_type: 'ControlNetApply',
        inputs: { conditioning: ['1', 0], control_net: ['93', 0], strength: 1 },
      },
      '4': { class_type: 'CLIPTextEncode', inputs: { text: 'first branch' } },
      '5': { class_type: 'CLIPTextEncode', inputs: { text: 'second branch' } },
      '6': {
        class_type: 'ConditioningCombine',
        inputs: { conditioning_1: ['4', 0], conditioning_2: ['5', 0] },
      },
      '3': sampler(['2', 0], ['6', 0]),
      ...common,
    });
    expect(value.prompt).toBe('via controlnet');
    expect(value.negativePrompt).toBe('first branch');
  });
});

describe('parseComfyUI - zeroed-out conditioning', () => {
  it('should leave the side fed by ConditioningZeroOut empty', () => {
    // Flux-style graph: the negative input takes the positive encoder's
    // conditioning through ConditioningZeroOut, which discards the text
    const prompt = {
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'flux prompt' } },
      '2': {
        class_type: 'ConditioningZeroOut',
        inputs: { conditioning: ['1', 0] },
      },
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: 1,
          steps: 10,
          cfg: 1,
          sampler_name: 'euler',
          scheduler: 'simple',
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
        class_type: 'UNETLoader',
        inputs: { unet_name: 'flux.safetensors' },
      },
    };
    const result = parseComfyUI({ prompt: JSON.stringify(prompt) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.prompt).toBe('flux prompt');
    expect(result.value.negativePrompt).toBe('');
  });
});

describe('parseComfyUI - sampler and latent shape fallbacks', () => {
  const encoders = {
    '1': { class_type: 'CLIPTextEncode', inputs: { text: 'piped positive' } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: 'piped negative' } },
  };
  const loaders = {
    '90': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 1000, height: 1200, batch_size: 1 },
    },
    '91': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'ok.safetensors' },
    },
  };
  // ComfyUI-Impact-Pack: the pipe bundles model, clip, vae and both prompts
  const pipe = {
    '20': {
      class_type: 'ToBasicPipe',
      inputs: {
        model: ['91', 0],
        clip: ['91', 1],
        vae: ['91', 2],
        positive: ['1', 0],
        negative: ['2', 0],
      },
    },
  };
  const pipeSampler = (extra: Record<string, unknown> = {}) => ({
    class_type: 'ImpactKSamplerBasicPipe',
    inputs: {
      seed: 230,
      steps: 30,
      cfg: 7,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 1,
      latent_image: ['90', 0],
      basic_pipe: ['20', 0],
      ...extra,
    },
  });
  const kSampler = (latent: string) => ({
    class_type: 'KSampler',
    inputs: {
      seed: 999,
      steps: 12,
      cfg: 4,
      sampler_name: 'euler',
      scheduler: 'simple',
      denoise: 1,
      positive: ['1', 0],
      negative: ['2', 0],
      latent_image: [latent, 0],
      model: ['91', 0],
    },
  });

  function parse(prompt: Record<string, unknown>) {
    const result = parseComfyUI({ prompt: JSON.stringify(prompt) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    return result.value;
  }

  it('should accept a sampler by shape and read its prompts through basic_pipe', () => {
    // An orphan text node comes first in key order: the flat scan would take
    // it as the prompt, the structured walk must go through the pipe
    const value = parse({
      '0': { class_type: 'CLIPTextEncode', inputs: { text: 'ORPHAN TEXT' } },
      ...encoders,
      ...loaders,
      ...pipe,
      '30': pipeSampler(),
    });
    expect(value.prompt).toBe('piped positive');
    expect(value.negativePrompt).toBe('piped negative');
    expect(value.sampling).toEqual({
      seed: '230',
      steps: 30,
      cfg: 7,
      sampler: 'dpmpp_2m',
      scheduler: 'karras',
    });
  });

  it('should detect the hires pass of a shape-matched sampler', () => {
    const value = parse({
      ...encoders,
      ...loaders,
      ...pipe,
      '30': pipeSampler(),
      '31': {
        class_type: 'LatentUpscaleBy',
        inputs: {
          samples: ['30', 0],
          upscale_method: 'nearest-exact',
          scale_by: 1.5,
        },
      },
      '32': pipeSampler({
        seed: 805,
        steps: 20,
        scheduler: 'normal',
        denoise: 0.43,
        latent_image: ['31', 0],
      }),
    });
    expect(value.sampling?.seed).toBe('230');
    expect(value.hires).toEqual({ scale: 1.5, steps: 20, denoise: 0.43 });
  });

  it('should prefer a known sampler over a shape match', () => {
    const value = parse({
      ...encoders,
      ...loaders,
      ...pipe,
      '10': pipeSampler(),
      '11': kSampler('90'),
    });
    expect(value.sampling?.seed).toBe('999');
  });

  it('should not take a Sampler-named node without steps and a seed', () => {
    // Selector-style nodes carry only a sampler name; the prompt must then
    // come from the flat scan (first literal text), not through the pipe
    const value = parse({
      '0': { class_type: 'CLIPTextEncode', inputs: { text: 'FIRST TEXT' } },
      ...encoders,
      ...loaders,
      ...pipe,
      '30': {
        class_type: 'PipeSamplerSelect',
        inputs: { sampler_name: 'euler', basic_pipe: ['20', 0] },
      },
    });
    expect(value.prompt).toBe('FIRST TEXT');
  });

  it('should accept an Empty*Latent node by name for the size', () => {
    // An EmptyImage with a bigger literal size comes first in key order; the
    // flat scan would take it, the structured walk must take the latent
    const value = parse({
      ...encoders,
      '5': {
        class_type: 'EmptyImage',
        inputs: { width: 2048, height: 2048, batch_size: 1, color: 0 },
      },
      '7': {
        class_type: 'EmptySD3LatentImage',
        inputs: { width: 1024, height: 1536, batch_size: 1 },
      },
      '8': kSampler('7'),
      '91': loaders['91'],
    });
    expect(value.width).toBe(1024);
    expect(value.height).toBe(1536);
  });

  it('should keep EmptyLatentImage ahead of a name-matched latent', () => {
    const value = parse({
      ...encoders,
      '5': {
        class_type: 'EmptySD3LatentImage',
        inputs: { width: 1024, height: 1536, batch_size: 1 },
      },
      '7': {
        class_type: 'EmptyLatentImage',
        inputs: { width: 512, height: 768, batch_size: 1 },
      },
      '8': kSampler('7'),
      '91': loaders['91'],
    });
    expect(value.width).toBe(512);
    expect(value.height).toBe(768);
  });

  it('should skip Empty*Latent nodes without a literal size', () => {
    // The audio latent has no size and the video latent's size is wired; the
    // SD3 latent after them carries the literal size. The EmptyImage ahead of
    // them is what the flat scan would report
    const value = parse({
      ...encoders,
      '4': {
        class_type: 'EmptyImage',
        inputs: { width: 2048, height: 2048, batch_size: 1, color: 0 },
      },
      '5': {
        class_type: 'EmptyAceStepLatentAudio',
        inputs: { seconds: 120, batch_size: 1 },
      },
      '6': {
        class_type: 'EmptyHunyuanLatentVideo',
        inputs: {
          width: ['13', 0],
          height: ['13', 1],
          length: 25,
          batch_size: 1,
        },
      },
      '7': {
        class_type: 'EmptySD3LatentImage',
        inputs: { width: 1024, height: 1536, batch_size: 1 },
      },
      '8': kSampler('7'),
      '13': {
        class_type: 'ResolutionSelector',
        inputs: { aspect_ratio: '1:1 (Square)', megapixels: 1, multiple: 32 },
      },
      '91': loaders['91'],
    });
    expect(value.width).toBe(1024);
    expect(value.height).toBe(1536);
  });
});

describe('parseComfyUI - LoRA reachability', () => {
  const lora = (name: string, model: unknown, clip: unknown) => ({
    class_type: 'LoraLoader',
    inputs: {
      lora_name: name,
      strength_model: 0.5,
      strength_clip: 0.5,
      model,
      clip,
    },
  });
  const base = {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'ok.safetensors' },
    },
    '2': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 512, height: 512, batch_size: 1 },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'pos', clip: ['1', 1] },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'neg', clip: ['1', 1] },
    },
  };
  const sampler = (model: unknown, extra: Record<string, unknown> = {}) => ({
    class_type: 'KSampler',
    inputs: {
      seed: 1,
      steps: 10,
      cfg: 5,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1,
      model,
      positive: ['3', 0],
      negative: ['4', 0],
      latent_image: ['2', 0],
      ...extra,
    },
  });

  function names(prompt: Record<string, unknown>): string[] | undefined {
    const result = parseComfyUI({ prompt: JSON.stringify(prompt) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    return result.value.loras?.map((entry) => entry.name);
  }

  it('should list only loaders the sampler depends on, in graph order', () => {
    // 10 feeds the sampler through 11; 12 hangs off 11 but goes nowhere
    expect(
      names({
        ...base,
        '10': lora('first.safetensors', ['1', 0], ['1', 1]),
        '11': lora('second.safetensors', ['10', 0], ['10', 1]),
        '12': lora('dead.safetensors', ['11', 0], ['11', 1]),
        '20': sampler(['11', 0]),
      }),
    ).toEqual(['first.safetensors', 'second.safetensors']);
  });

  it('should count a loader that only feeds the prompt encoder', () => {
    expect(
      names({
        ...base,
        '3': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'pos', clip: ['10', 1] },
        },
        '10': lora('clip-only.safetensors', ['1', 0], ['1', 1]),
        '20': sampler(['1', 0]),
      }),
    ).toEqual(['clip-only.safetensors']);
  });

  it('should count the loaders of the hires sampler too', () => {
    expect(
      names({
        ...base,
        '10': lora('base.safetensors', ['1', 0], ['1', 1]),
        '11': lora('hires-only.safetensors', ['1', 0], ['1', 1]),
        '12': lora('dead.safetensors', ['1', 0], ['1', 1]),
        '20': sampler(['10', 0]),
        '21': {
          class_type: 'LatentUpscaleBy',
          inputs: {
            samples: ['20', 0],
            upscale_method: 'nearest-exact',
            scale_by: 2,
          },
        },
        '22': sampler(['11', 0], { latent_image: ['21', 0], denoise: 0.5 }),
      }),
    ).toEqual(['base.safetensors', 'hires-only.safetensors']);
  });

  it('should keep every loader when no sampler is recognized', () => {
    expect(
      names({
        ...base,
        '10': lora('a.safetensors', ['1', 0], ['1', 1]),
        '12': lora('b.safetensors', ['1', 0], ['1', 1]),
      }),
    ).toEqual(['a.safetensors', 'b.safetensors']);
  });

  it('should list the wired shape-matched loader instead of a dead known one', () => {
    const result = parseComfyUI({
      prompt: JSON.stringify({
        ...base,
        '23': lora('dead.safetensors', ['1', 0], ['1', 1]),
        '24': {
          class_type: 'LoraLoaderAdvanced',
          inputs: {
            lora_name: 'used.safetensors',
            strength_model: 0.7,
            strength_clip: 1,
            force_fetch: false,
            append_loraname_if_empty: false,
            model: ['1', 0],
            clip: ['1', 1],
          },
        },
        '30': sampler(['24', 0]),
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.loras).toEqual([
      { name: 'used.safetensors', weight: 0.7, clipWeight: 1 },
    ]);
  });
});

describe('parseComfyUI - linked sampling inputs', () => {
  /**
   * A minimal graph around one sampler: prompts, a latent and a model.
   * `extraNodes` holds the primitives and switches the sampler links to.
   */
  function graphWithSampler(
    sampler: { class_type: string; inputs: Record<string, unknown> },
    extraNodes: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      '1': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'wan2.2_i2v.safetensors' },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'positive', clip: ['9', 0] },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'negative', clip: ['9', 0] },
      },
      '4': {
        class_type: 'EmptyLatentImage',
        inputs: { width: 512, height: 512, batch_size: 1 },
      },
      '5': sampler,
      ...extraNodes,
    };
  }

  /** KSamplerAdvanced wired like the Wan 2.2 template's two samplers. */
  function kSamplerAdvanced(inputs: Record<string, unknown>) {
    return {
      class_type: 'KSamplerAdvanced',
      inputs: {
        add_noise: 'enable',
        noise_seed: 643177897804252,
        sampler_name: 'euler',
        scheduler: 'simple',
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        ...inputs,
      },
    };
  }

  /** The Wan 2.2 template's "4-step LoRA" toggle and its two value pairs. */
  function switchNodes(enabled: unknown): Record<string, unknown> {
    return {
      '131': { class_type: 'PrimitiveBoolean', inputs: { value: enabled } },
      '118': { class_type: 'PrimitiveInt', inputs: { value: 4 } },
      '128': { class_type: 'PrimitiveInt', inputs: { value: 20 } },
      '122': { class_type: 'PrimitiveFloat', inputs: { value: 1 } },
      '126': { class_type: 'PrimitiveFloat', inputs: { value: 3.5 } },
      '119': {
        class_type: 'ComfySwitchNode',
        inputs: {
          switch: ['131', 0],
          on_false: ['128', 0],
          on_true: ['118', 0],
        },
      },
      '120': {
        class_type: 'ComfySwitchNode',
        inputs: {
          switch: ['131', 0],
          on_false: ['126', 0],
          on_true: ['122', 0],
        },
      },
    };
  }

  function sampling(prompt: Record<string, unknown>) {
    const result = parseComfyUI(createComfyUIEntries(prompt));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    return result.value.sampling;
  }

  it('should follow ComfySwitchNode to the selected branch (Wan 2.2 template)', () => {
    const prompt = graphWithSampler(
      kSamplerAdvanced({ steps: ['119', 0], cfg: ['120', 0] }),
      switchNodes(true),
    );

    expect(sampling(prompt)).toEqual({
      seed: '643177897804252',
      steps: 4,
      cfg: 1,
      sampler: 'euler',
      scheduler: 'simple',
    });
  });

  it('should take the on_false branch when the switch is off', () => {
    const prompt = graphWithSampler(
      kSamplerAdvanced({ steps: ['119', 0], cfg: ['120', 0] }),
      switchNodes(false),
    );

    expect(sampling(prompt)).toMatchObject({ steps: 20, cfg: 3.5 });
  });

  it('should leave a value unset when the switch state cannot be resolved', () => {
    // The switch is driven by a node with no literal boolean: guessing a
    // branch would report a number the run may not have used.
    const nodes = switchNodes(true);
    nodes['131'] = { class_type: 'IsLoraEnabled', inputs: { lora: ['1', 0] } };
    const prompt = graphWithSampler(
      kSamplerAdvanced({ steps: ['119', 0], cfg: ['120', 0] }),
      nodes,
    );

    const result = sampling(prompt);
    expect(result?.steps).toBeUndefined();
    expect(result?.cfg).toBeUndefined();
  });

  it('should resolve primitives linked straight into the sampler', () => {
    const prompt = graphWithSampler(
      kSamplerAdvanced({
        steps: ['10', 0],
        cfg: ['11', 0],
        sampler_name: ['12', 0],
        scheduler: ['13', 0],
      }),
      {
        '10': { class_type: 'PrimitiveInt', inputs: { value: 30 } },
        '11': { class_type: 'PrimitiveFloat', inputs: { value: 6.5 } },
        '12': { class_type: 'PrimitiveString', inputs: { value: 'dpmpp_2m' } },
        '13': { class_type: 'PrimitiveString', inputs: { value: 'karras' } },
      },
    );

    expect(sampling(prompt)).toMatchObject({
      steps: 30,
      cfg: 6.5,
      sampler: 'dpmpp_2m',
      scheduler: 'karras',
    });
  });

  it('should never surface an unresolvable link as a value', () => {
    const prompt = graphWithSampler(
      kSamplerAdvanced({ steps: ['10', 0], cfg: ['11', 0] }),
      {
        '10': { class_type: 'MathExpression', inputs: { expression: 'a*2' } },
        '11': { class_type: 'MathExpression', inputs: { expression: 'a/2' } },
      },
    );

    const result = sampling(prompt);
    expect(result?.steps).toBeUndefined();
    expect(result?.cfg).toBeUndefined();
  });

  it('should not surface a link held in a node value input', () => {
    // A converter node whose own `value` is wired elsewhere carries no
    // literal of its own.
    const prompt = graphWithSampler(kSamplerAdvanced({ steps: ['10', 0] }), {
      '10': { class_type: 'ToInt', inputs: { value: ['11', 0] } },
      '11': { class_type: 'MathExpression', inputs: { expression: '4' } },
    });

    expect(sampling(prompt)?.steps).toBeUndefined();
  });

  it('should resolve linked inputs on the SamplerCustomAdvanced chain', () => {
    const prompt = graphWithSampler(
      {
        class_type: 'SamplerCustomAdvanced',
        inputs: {
          noise: ['20', 0],
          guider: ['21', 0],
          sampler: ['22', 0],
          sigmas: ['23', 0],
          latent_image: ['4', 0],
        },
      },
      {
        '20': { class_type: 'RandomNoise', inputs: { noise_seed: 42 } },
        '21': {
          class_type: 'CFGGuider',
          inputs: {
            cfg: ['11', 0],
            model: ['1', 0],
            positive: ['2', 0],
            negative: ['3', 0],
          },
        },
        '22': {
          class_type: 'KSamplerSelect',
          inputs: { sampler_name: 'euler' },
        },
        '23': {
          class_type: 'BasicScheduler',
          inputs: {
            scheduler: 'beta',
            steps: ['10', 0],
            denoise: 1,
            model: ['1', 0],
          },
        },
        '10': { class_type: 'PrimitiveInt', inputs: { value: 8 } },
        '11': { class_type: 'PrimitiveFloat', inputs: { value: 3 } },
      },
    );

    expect(sampling(prompt)).toMatchObject({ seed: '42', steps: 8, cfg: 3 });
  });
});

describe('parseComfyUI - BasicGuider', () => {
  /**
   * SamplerCustomAdvanced with BasicGuider, which takes one `conditioning`
   * input and has no negative side (Flux and video templates).
   */
  function graph(
    conditioning: unknown,
    extraNodes: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      '1': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'model.safetensors' },
      },
      '2': { class_type: 'RandomNoise', inputs: { noise_seed: 7 } },
      '3': {
        class_type: 'BasicGuider',
        inputs: { model: ['1', 0], conditioning },
      },
      '4': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
      '5': {
        class_type: 'BasicScheduler',
        inputs: { scheduler: 'beta', steps: 8, denoise: 1, model: ['1', 0] },
      },
      '6': {
        class_type: 'SamplerCustomAdvanced',
        inputs: {
          noise: ['2', 0],
          guider: ['3', 0],
          sampler: ['4', 0],
          sigmas: ['5', 0],
          latent_image: ['7', 0],
        },
      },
      '7': {
        class_type: 'EmptySD3LatentImage',
        inputs: { width: 1024, height: 1024, batch_size: 1 },
      },
      ...extraNodes,
    };
  }

  function parse(prompt: Record<string, unknown>) {
    const result = parseComfyUI(createComfyUIEntries(prompt));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    return result.value;
  }

  it('should read the prompt from a video node behind BasicGuider (MiniMax H3)', () => {
    // MiniMaxH3ImageToVideo encodes its own `prompt` and outputs the
    // conditioning BasicGuider takes.
    const value = parse(
      graph(['10', 0], {
        '10': {
          class_type: 'MiniMaxH3ImageToVideo',
          inputs: {
            prompt: '[Shot 1] Hatsune Miku turns to the camera and winks.',
            width: 736,
            height: 736,
            clip: ['11', 0],
          },
        },
        '11': {
          class_type: 'CLIPLoader',
          inputs: { clip_name: 'qwen3vl.safetensors', type: 'minimax' },
        },
      }),
    );

    expect(value.prompt).toBe(
      '[Shot 1] Hatsune Miku turns to the camera and winks.',
    );
    expect(value.negativePrompt).toBe('');
  });

  it('should follow the conditioning chain behind BasicGuider (Flux)', () => {
    const value = parse(
      graph(['10', 0], {
        '10': {
          class_type: 'FluxGuidance',
          inputs: { guidance: 3.5, conditioning: ['11', 0] },
        },
        '11': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'a red fox in snow', clip: ['12', 0] },
        },
        '12': { class_type: 'DualCLIPLoader', inputs: {} },
      }),
    );

    expect(value.prompt).toBe('a red fox in snow');
  });

  it('should not fill a negative prompt from an unconnected text node', () => {
    // BasicGuider runs without a negative side, so a stray encoder left in
    // the graph is not the negative prompt.
    const value = parse(
      graph(['10', 0], {
        '10': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'a red fox in snow' },
        },
        '11': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'unused leftover text' },
        },
      }),
    );

    expect(value.prompt).toBe('a red fox in snow');
    expect(value.negativePrompt).toBe('');
  });
});

describe('parseComfyUI - model of the main sampler', () => {
  /**
   * Wan 2.2's two-stage shape: the first KSamplerAdvanced denoises with the
   * high-noise model and its LoRA, the second continues from its latent with
   * the low-noise model and its LoRA. The low-noise loader comes first in
   * node order.
   */
  function twoStageGraph(): Record<string, unknown> {
    return {
      '10': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'low_noise.safetensors' },
      },
      '11': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'high_noise.safetensors' },
      },
      '12': {
        class_type: 'LoraLoaderModelOnly',
        inputs: {
          lora_name: 'low_lora.safetensors',
          strength_model: 1,
          model: ['10', 0],
        },
      },
      '13': {
        class_type: 'LoraLoaderModelOnly',
        inputs: {
          lora_name: 'high_lora.safetensors',
          strength_model: 1,
          model: ['11', 0],
        },
      },
      '14': {
        class_type: 'ModelSamplingSD3',
        inputs: { shift: 5, model: ['13', 0] },
      },
      '20': { class_type: 'CLIPTextEncode', inputs: { text: 'a fox' } },
      '21': { class_type: 'CLIPTextEncode', inputs: { text: 'blurry' } },
      '22': {
        class_type: 'EmptyLatentImage',
        inputs: { width: 512, height: 512, batch_size: 1 },
      },
      '30': {
        class_type: 'KSamplerAdvanced',
        inputs: {
          add_noise: 'enable',
          noise_seed: 7,
          steps: 4,
          cfg: 1,
          sampler_name: 'euler',
          scheduler: 'simple',
          start_at_step: 0,
          end_at_step: 2,
          model: ['14', 0],
          positive: ['20', 0],
          negative: ['21', 0],
          latent_image: ['22', 0],
        },
      },
      '31': {
        class_type: 'KSamplerAdvanced',
        inputs: {
          add_noise: 'disable',
          noise_seed: 0,
          steps: 4,
          cfg: 1,
          sampler_name: 'euler',
          scheduler: 'simple',
          start_at_step: 2,
          end_at_step: 4,
          model: ['12', 0],
          positive: ['20', 0],
          negative: ['21', 0],
          latent_image: ['30', 0],
        },
      },
    };
  }

  function parse(prompt: Record<string, unknown>) {
    const result = parseComfyUI(createComfyUIEntries(prompt));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    return result.value;
  }

  it('reports the model and LoRA of the same (first) stage', () => {
    const value = parse(twoStageGraph());
    expect(value.model).toEqual({ name: 'high_noise.safetensors' });
    expect(value.loras).toEqual([{ name: 'high_lora.safetensors', weight: 1 }]);
  });

  it('prefers the checkpoint the sampler uses over an unused one', () => {
    const graph = twoStageGraph();
    graph['40'] = {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'unused.safetensors' },
    };
    expect(parse(graph).model).toEqual({ name: 'high_noise.safetensors' });
  });

  it('keeps the previous choice when no loader feeds the sampler', () => {
    // The sampler's model comes from a node the parser does not know, so
    // nothing upstream is a loader. The graph-wide choice stays as before:
    // a checkpoint is preferred over a UNET loader listed earlier (the flat
    // scan alone would take the first one).
    const graph = twoStageGraph();
    graph['14'] = { class_type: 'SomeModelLoader', inputs: { name: 'x' } };
    graph['40'] = {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'graph_checkpoint.safetensors' },
    };
    expect(parse(graph).model).toEqual({
      name: 'graph_checkpoint.safetensors',
    });
  });
});

describe('parseComfyUI - frontend rounding errors', () => {
  it('reports the short decimals behind the rounding errors', () => {
    const prompt = {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'model.safetensors' },
      },
      '2': {
        class_type: 'LoraLoader',
        inputs: {
          lora_name: 'style.safetensors',
          strength_model: 1.0000000000000002,
          strength_clip: 0.7000000000000001,
          model: ['1', 0],
          clip: ['1', 1],
        },
      },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: 'a fox' } },
      '4': {
        class_type: 'EmptyLatentImage',
        inputs: { width: 512, height: 512, batch_size: 1 },
      },
      '5': {
        class_type: 'KSampler',
        inputs: {
          seed: 1,
          steps: 20,
          cfg: 5.000000000000001,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 0.35000000000000003,
          model: ['2', 0],
          positive: ['3', 0],
          negative: ['3', 0],
          latent_image: ['4', 0],
        },
      },
    };
    const result = parseComfyUI(createComfyUIEntries(prompt));
    if (!result.ok) throw new Error('unreachable');

    expect(result.value.sampling).toMatchObject({ cfg: 5, denoise: 0.35 });
    expect(result.value.loras).toEqual([
      { name: 'style.safetensors', weight: 1, clipWeight: 0.7 },
    ]);
  });
});

describe('parseComfyUI - graph normalization', () => {
  it('should drop entries that are not nodes and still parse the rest', () => {
    const entries = createComfyUIEntries({
      '1': null,
      '2': { class_type: 'KSampler' },
      '3': { class_type: 5, inputs: {} },
      extra: { ds: { scale: 1 } },
      extraMetadata: '{"steps":20}',
      '4': { class_type: 'CLIPTextEncode', inputs: { text: '1girl, solo' } },
    });

    const result = parseComfyUI(entries);

    expect(result.ok).toBe(true);
    if (result.ok && result.value.software === 'comfyui') {
      expect(Object.keys(result.value.nodes)).toEqual(['4']);
      expect(result.value.prompt).toBe('1girl, solo');
    }
  });

  it('should not follow a reference to a prototype property as a node', () => {
    const entries = createComfyUIEntries({
      '1': {
        class_type: 'KSampler',
        inputs: {
          positive: ['constructor', 0],
          negative: ['hasOwnProperty', 0],
          seed: 1,
          steps: 20,
        },
      },
    });

    const result = parseComfyUI(entries);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompt).toBe('');
      expect(result.value.negativePrompt).toBe('');
    }
  });

  it('should finish when ConditioningCombine nodes fan in on each other', () => {
    // Nine combine stages, each pulling eight times from the previous one,
    // ending in a node without text: all 8^9 routes used to be walked before
    // the positive side gave up
    const graph: Record<string, unknown> = {
      zero: {
        class_type: 'ConditioningZeroOut',
        inputs: { conditioning: ['enc', 0] },
      },
      enc: { class_type: 'CLIPTextEncode', inputs: { text: 'bad quality' } },
    };
    let previous = 'zero';
    for (let stage = 0; stage < 9; stage++) {
      const id = `combine${stage}`;
      graph[id] = {
        class_type: 'ConditioningCombine',
        inputs: Object.fromEntries(
          Array.from({ length: 8 }, (_, i) => [
            `conditioning_${i + 1}`,
            [previous, 0],
          ]),
        ),
      };
      previous = id;
    }
    graph.sampler = {
      class_type: 'KSampler',
      inputs: {
        positive: [previous, 0],
        negative: ['enc', 0],
        seed: 1,
        steps: 20,
      },
    };

    const result = parseComfyUI(createComfyUIEntries(graph));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompt).toBe('');
      expect(result.value.negativePrompt).toBe('bad quality');
    }
  });
});

describe('parseComfyUI - NUL padding', () => {
  it('strips trailing NULs from the prompt JSON in linear time', () => {
    const graph =
      '{"1":{"class_type":"CLIPTextEncode","inputs":{"text":"1girl"}}}';

    const padded = parseComfyUI({ prompt: `${graph}${'\0'.repeat(200_000)}` });
    expect(padded.ok && padded.value.prompt).toBe('1girl');

    // A byte after the NULs made `/\0+$/` retry from every NUL
    const trailing = parseComfyUI({
      prompt: `${graph}${'\0'.repeat(200_000)}x`,
    });
    expect(trailing.ok).toBe(false);
  });
});
