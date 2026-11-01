import { describe, expect, it } from 'vitest';
import { extractComfyLoras } from '../../../src/parsers/comfyui-loras';
import type { ComfyNodeGraph } from '../../../src/types';

/** Build a graph from class_type / inputs pairs, keyed in order */
function graph(...nodes: [string, Record<string, unknown>][]): ComfyNodeGraph {
  return Object.fromEntries(
    nodes.map(([class_type, inputs], i) => [
      String(i + 1),
      { class_type, inputs: inputs as ComfyNodeGraph[string]['inputs'] },
    ]),
  );
}

describe('extractComfyLoras', () => {
  describe('core loaders', () => {
    it('should read LoraLoader chains in graph order with both strengths', () => {
      const nodes = graph(
        [
          'LoraLoader',
          {
            lora_name: 'A.safetensors',
            strength_model: -0.8,
            strength_clip: -0.7,
            model: ['0', 0],
            clip: ['0', 1],
          },
        ],
        [
          'LoraLoader',
          { lora_name: 'B.safetensors', strength_model: 0.9, strength_clip: 1 },
        ],
      );

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: -0.8, clipWeight: -0.7 },
        { name: 'B.safetensors', weight: 0.9, clipWeight: 1 },
      ]);
    });

    it('should read LoraLoaderModelOnly without a clip weight', () => {
      const nodes = graph([
        'LoraLoaderModelOnly',
        { lora_name: 'A.safetensors', strength_model: 0.3, model: ['0', 0] },
      ]);

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: 0.3 },
      ]);
    });

    it('should skip names that are node references and leave out wired strengths', () => {
      const nodes = graph(
        ['LoraLoader', { lora_name: ['9', 0], strength_model: 1 }],
        [
          'LoraLoader',
          {
            lora_name: 'A.safetensors',
            strength_model: ['9', 0],
            strength_clip: 0.5,
          },
        ],
      );

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', clipWeight: 0.5 },
      ]);
    });

    it('should keep duplicates and ignore CLIPTextEncode tags', () => {
      const nodes = graph(
        ['LoraLoader', { lora_name: 'A.safetensors', strength_model: 1 }],
        ['LoraLoader', { lora_name: 'A.safetensors', strength_model: 0.5 }],
        ['CLIPTextEncode', { text: '1girl <lora:A:0.7>', clip: ['0', 1] }],
      );

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: 1 },
        { name: 'A.safetensors', weight: 0.5 },
      ]);
    });

    it('should return an empty list for graphs without loaders', () => {
      expect(extractComfyLoras({})).toEqual([]);
      expect(
        extractComfyLoras(graph(['KSampler', { seed: 1 }], ['Unknown', {}])),
      ).toEqual([]);
    });
  });

  describe('ComfyRoll', () => {
    it('should read CR LoRA Stack slots that are On and named', () => {
      const nodes = graph([
        'CR LoRA Stack',
        {
          switch_1: 'On',
          lora_name_1: 'A.safetensors',
          model_weight_1: -0.7,
          clip_weight_1: -0.6,
          switch_2: 'Off',
          lora_name_2: 'B.safetensors',
          model_weight_2: 0.95,
          clip_weight_2: 0.92,
          switch_3: 'On',
          lora_name_3: 'None',
          model_weight_3: 1,
          clip_weight_3: 1,
        },
      ]);

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: -0.7, clipWeight: -0.6 },
      ]);
    });
  });

  describe('rgthree', () => {
    it('should read Power Lora Loader slots that are on', () => {
      const nodes = graph([
        'Power Lora Loader (rgthree)',
        {
          PowerLoraLoaderHeaderWidget: { type: 'PowerLoraLoaderHeaderWidget' },
          lora_1: { on: true, lora: 'A.safetensors', strength: -0.5 },
          lora_2: { on: false, lora: 'B.safetensors', strength: 0.6 },
          lora_3: { on: true, lora: 'C.safetensors', strength: 0.4 },
          '➕ Add Lora': '',
          model: ['0', 0],
          clip: ['0', 1],
        },
      ]);

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: -0.5 },
        { name: 'C.safetensors', weight: 0.4 },
      ]);
    });

    it('should read Lora Loader Stack slots that are not None', () => {
      const nodes = graph([
        'Lora Loader Stack (rgthree)',
        {
          lora_01: 'A.safetensors',
          strength_01: -0.4,
          lora_02: 'None',
          strength_02: 1,
          lora_03: 'C.safetensors',
          strength_03: 0.35,
          lora_04: 'None',
          strength_04: 1,
          model: ['0', 0],
          clip: ['0', 1],
        },
      ]);

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: -0.4 },
        { name: 'C.safetensors', weight: 0.35 },
      ]);
    });

    it('should read tags from the Power Prompt text', () => {
      const nodes = graph(
        [
          'Power Prompt (rgthree)',
          {
            prompt: '1girl, \n<lora:A:-0.5> <lora:B:0.8:0.6>',
            insert_lora: 'CHOOSE',
          },
        ],
        ['Power Prompt (rgthree)', { prompt: 'no tags here' }],
      );

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A', weight: -0.5 },
        { name: 'B', weight: 0.6, clipWeight: 0.8 },
      ]);
    });
  });

  describe('efficiency-nodes', () => {
    it('should read the Efficient Loader slot and the LoRA Stacker up to lora_count', () => {
      const nodes = graph(
        [
          'Efficient Loader',
          {
            ckpt_name: 'model.safetensors',
            lora_name: 'A.safetensors',
            lora_model_strength: 0.8,
            lora_clip_strength: 0.3,
            lora_stack: ['2', 0],
          },
        ],
        [
          'LoRA Stacker',
          {
            input_mode: 'advanced',
            lora_count: 2,
            lora_name_1: 'B.safetensors',
            lora_wt_1: 1,
            model_str_1: -0.5,
            clip_str_1: -0.4,
            lora_name_2: 'None',
            lora_wt_2: 1,
            model_str_2: 0.8,
            clip_str_2: 0.6,
            lora_name_3: 'C.safetensors',
            lora_wt_3: 1,
            model_str_3: 0.4,
            clip_str_3: 0.35,
          },
        ],
      );

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: 0.8, clipWeight: 0.3 },
        { name: 'B.safetensors', weight: -0.5, clipWeight: -0.4 },
      ]);
    });

    it('should use lora_wt in simple mode and skip a loader slot set to None', () => {
      const nodes = graph(
        ['Efficient Loader', { lora_name: 'None', lora_model_strength: 1 }],
        [
          'LoRA Stacker',
          {
            input_mode: 'simple',
            lora_count: 1,
            lora_name_1: 'B.safetensors',
            lora_wt_1: 0.7,
            model_str_1: -0.5,
            clip_str_1: -0.4,
          },
        ],
      );

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'B.safetensors', weight: 0.7 },
      ]);
    });
  });

  describe('ComfyUI-Easy-Use', () => {
    it('should read the easy fullLoader slot and easy loraStack up to num_loras', () => {
      const nodes = graph(
        [
          'easy fullLoader',
          {
            lora_name: 'A.safetensors',
            lora_model_strength: 0.6,
            lora_clip_strength: 0.5,
            positive: '1girl',
          },
        ],
        [
          'easy loraStack',
          {
            toggle: true,
            mode: 'advanced',
            num_loras: 1,
            lora_1_name: 'B.safetensors',
            lora_1_strength: 1,
            lora_1_model_strength: -0.9,
            lora_1_clip_strength: -0.85,
            lora_2_name: 'C.safetensors',
            lora_2_strength: 1,
            lora_2_model_strength: 0.4,
            lora_2_clip_strength: 0.2,
          },
        ],
      );

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A.safetensors', weight: 0.6, clipWeight: 0.5 },
        { name: 'B.safetensors', weight: -0.9, clipWeight: -0.85 },
      ]);
    });

    it('should use the single strength in simple mode and nothing when toggled off', () => {
      const simple = graph([
        'easy loraStack',
        {
          toggle: true,
          mode: 'simple',
          num_loras: 1,
          lora_1_name: 'B.safetensors',
          lora_1_strength: 0.75,
          lora_1_model_strength: -0.9,
          lora_1_clip_strength: -0.85,
        },
      ]);
      expect(extractComfyLoras(simple)).toEqual([
        { name: 'B.safetensors', weight: 0.75 },
      ]);

      const off = graph([
        'easy loraStack',
        {
          toggle: false,
          mode: 'simple',
          num_loras: 1,
          lora_1_name: 'B.safetensors',
          lora_1_strength: 0.75,
        },
      ]);
      expect(extractComfyLoras(off)).toEqual([]);
    });

    it('should read only the selected slot of easy loraSwitcher', () => {
      const inputs = {
        toggle: true,
        select: 2,
        num_loras: 2,
        lora_strength: 0.8,
        lora_1_name: 'A.safetensors',
        lora_2_name: 'B.safetensors',
        lora_3_name: 'None',
      };

      expect(extractComfyLoras(graph(['easy loraSwitcher', inputs]))).toEqual([
        { name: 'B.safetensors', weight: 0.8 },
      ]);
      expect(
        extractComfyLoras(
          graph(['easy loraSwitcher', { ...inputs, select: 3 }]),
        ),
      ).toEqual([]);
      expect(
        extractComfyLoras(
          graph(['easy loraSwitcher', { ...inputs, toggle: false }]),
        ),
      ).toEqual([]);
    });
  });

  describe('LoRA Manager', () => {
    it('should read active entries with their string strengths and ignore the tag text', () => {
      const nodes = graph([
        'Lora Loader (LoraManager)',
        {
          text: '<lora:A:-0.55:-0.55><lora:B:0.70><lora:C:0.65>',
          loras: [
            {
              name: 'A',
              strength: '-0.55',
              active: true,
              clipStrength: '-0.55',
            },
            {
              name: 'B',
              strength: '0.70',
              active: false,
              clipStrength: '0.70',
            },
            { name: 'C', strength: '0.65', active: true, clipStrength: '0.65' },
          ],
          model: ['0', 0],
          clip: ['0', 1],
        },
      ]);

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'A', weight: -0.55, clipWeight: -0.55 },
        { name: 'C', weight: 0.65, clipWeight: 0.65 },
      ]);
    });
  });

  describe('TensorArt', () => {
    it('should read tags from the LoraTagLoader text', () => {
      const nodes = graph([
        'LoraTagLoader',
        {
          clip: ['0', 1],
          model: ['0', 0],
          text: '<lora:EMS-1-EMS.safetensors:0.200000>,<lora:EMS-2-EMS.safetensors:0.400000>',
        },
      ]);

      expect(extractComfyLoras(nodes)).toEqual([
        { name: 'EMS-1-EMS.safetensors', weight: 0.2 },
        { name: 'EMS-2-EMS.safetensors', weight: 0.4 },
      ]);
    });
  });
});
