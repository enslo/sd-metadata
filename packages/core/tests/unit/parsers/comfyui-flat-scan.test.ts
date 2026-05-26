import { describe, expect, it } from 'vitest';
import { flatScanComfyMetadata } from '../../../src/parsers/comfyui-flat-scan';
import type { ComfyNodeGraph } from '../../../src/types';

describe('flatScanComfyMetadata', () => {
  describe('prompt extraction', () => {
    it('should extract positive and negative from CLIPTextEncode nodes by order', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { text: 'a beautiful landscape' },
          class_type: 'CLIPTextEncode',
        },
        '2': {
          inputs: { text: 'lowres, bad anatomy' },
          class_type: 'CLIPTextEncode',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.prompt).toBe('a beautiful landscape');
      expect(result.negativePrompt).toBe('lowres, bad anatomy');
    });

    it('should classify by class_type containing "neg" regardless of order', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { text: 'negative content' },
          class_type: 'CLIPTextEncodeNegative',
        },
        '2': {
          inputs: { text: 'positive content' },
          class_type: 'CLIPTextEncodePositive',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.prompt).toBe('positive content');
      expect(result.negativePrompt).toBe('negative content');
    });

    it('should match text-box style nodes (DF_Text_Box, CR Text Box)', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { Text: 'from ComfyRoll text box' },
          class_type: 'CR Text Box',
        },
        '2': {
          inputs: { text: 'from DF text box' },
          class_type: 'DF_Text_Box',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.prompt).toBe('from ComfyRoll text box');
      expect(result.negativePrompt).toBe('from DF text box');
    });

    it('should accept prompt_text input key (PromptStashSaver)', () => {
      const nodes: ComfyNodeGraph = {
        '32': {
          inputs: { prompt_text: 'score_9, score_8_up, ...' },
          class_type: 'PromptStashSaver',
        },
        '33': {
          inputs: { prompt_text: 'score_5, score_4, ...' },
          class_type: 'PromptStashSaver',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.prompt).toBe('score_9, score_8_up, ...');
      expect(result.negativePrompt).toBe('score_5, score_4, ...');
    });

    it('should accept text_0 input key (ShowText|pysssss)', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { text_0: 'cached prompt from ShowText' },
          class_type: 'ShowText|pysssss',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.prompt).toBe('cached prompt from ShowText');
    });

    it('should accept "prompt" input key (Power Prompt rgthree)', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { prompt: 'a girl with a sword' },
          class_type: 'CLIPTextEncodeSDXL',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.prompt).toBe('a girl with a sword');
    });

    it('should ignore node references and only consume literal strings', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { text: ['5', 0] },
          class_type: 'CLIPTextEncode',
        },
        '2': {
          inputs: { text: 'literal text' },
          class_type: 'CLIPTextEncode',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.prompt).toBe('literal text');
    });
  });

  describe('sampling extraction', () => {
    it('should extract seed/steps/cfg/sampler/scheduler from KSampler', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: {
            seed: 12345,
            steps: 25,
            cfg: 7,
            sampler_name: 'euler',
            scheduler: 'normal',
          },
          class_type: 'KSampler',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.sampling).toEqual({
        seed: 12345,
        steps: 25,
        cfg: 7,
        sampler: 'euler',
        scheduler: 'normal',
      });
    });

    it('should accept noise_seed as a seed alias', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { noise_seed: 99 },
          class_type: 'KSamplerAdvanced',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.sampling?.seed).toBe(99);
    });

    it('should only read sampler fields from nodes with "Sampler" in class_type', () => {
      const nodes: ComfyNodeGraph = {
        // Non-sampler node with steps/seed should be ignored
        '1': {
          inputs: { steps: 999, seed: 999 },
          class_type: 'BasicScheduler',
        },
        '2': {
          inputs: { steps: 20, seed: 42 },
          class_type: 'KSampler',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.sampling?.seed).toBe(42);
      expect(result.sampling?.steps).toBe(20);
    });

    it('should pick the first sampler when multiple exist', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { seed: 100, steps: 10 },
          class_type: 'KSampler',
        },
        '2': {
          inputs: { seed: 200, steps: 20 },
          class_type: 'KSampler',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.sampling?.seed).toBe(100);
      expect(result.sampling?.steps).toBe(10);
    });
  });

  describe('model extraction', () => {
    it('should extract ckpt_name from any node', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { ckpt_name: 'sdxl-base.safetensors' },
          class_type: 'CheckpointLoaderSimple',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.model).toEqual({ name: 'sdxl-base.safetensors' });
    });

    it('should fall back to unet_name', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { unet_name: 'flux1-dev.safetensors' },
          class_type: 'UNETLoader',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.model).toEqual({ name: 'flux1-dev.safetensors' });
    });
  });

  describe('dimension extraction', () => {
    it('should extract width/height from EmptyLatentImage', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { width: 1024, height: 768 },
          class_type: 'EmptyLatentImage',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });

    it('should accept numeric-string dimensions', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { width: 512, height: 512 },
          class_type: 'EmptyLatentImage',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.width).toBe(512);
      expect(result.height).toBe(512);
    });

    it('should omit dimensions when both are missing', () => {
      const nodes: ComfyNodeGraph = {
        '1': {
          inputs: { text: 'hello' },
          class_type: 'CLIPTextEncode',
        },
      };
      const result = flatScanComfyMetadata(nodes);
      expect(result.width).toBeUndefined();
      expect(result.height).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should return empty result for an empty graph', () => {
      expect(flatScanComfyMetadata({})).toEqual({});
    });

    it('should skip malformed nodes without throwing', () => {
      const nodes = {
        '1': null as unknown as never,
        '2': { class_type: 'KSampler', inputs: { seed: 7, steps: 10 } },
      } as ComfyNodeGraph;
      const result = flatScanComfyMetadata(nodes);
      expect(result.sampling?.seed).toBe(7);
    });
  });
});
