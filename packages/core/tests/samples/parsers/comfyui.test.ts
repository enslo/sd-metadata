import { describe, expect, it } from 'vitest';
import { parseMetadata } from '../../../src/parsers';
import { parseComfyUI } from '../../../src/parsers/comfyui';
import type { ComfyUIMetadata } from '../../../src/types';
import { expectComfyNodeGraph } from '../../helpers/comfy-node-graph';
import { parseConvertedSample, parsePngSample } from '../helpers';

describe('ComfyUI Parsers - Samples', () => {
  describe('PNG samples', () => {
    it('should parse comfyui.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>('comfyui.png', parseComfyUI);

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '422847914351919',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-hires.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-hires.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '1116526567339338',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: {
          scale: 1.5,
          upscaler: 'RealESRGAN_x4plus_anime_6B.pth',
          steps: 10,
          denoise: 0.3,
        },
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-upscale.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-upscale.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '511796159331902',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: {
          upscaler: 'SwinIR_4x.pth',
          scale: 1.5,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-low-denoise.png with denoise in sampling', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-low-denoise.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, 4k, very aesthetic, ultra-detailed, (pixel art, dithering, pixelated, sprite art, 8-bit:1.2), \n1girl, solo, hatsune miku, cowboy shot, #テスト \n',
        negativePrompt:
          'modern, recent, old, oldest, anime, illustration, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured, long body, lowres, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, cropped, very displeasing, (worst quality, bad quality:1.2), sketch, jpeg artifacts, signature, watermark, username, signature, simple background, conjoined, bad ai-generated, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'novaPixelsXL_v30.safetensors',
        },
        sampling: {
          seed: '667022537790957',
          steps: 40,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          denoise: 0.8,
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-saveimage-plus.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-saveimage-plus.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '434067965194649',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-save-image-extended.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-save-image-extended.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '779742380066441',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-saveimagewithmetadata.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-saveimagewithmetadata.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '38802053347333',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-comfy-image-saver.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-comfy-image-saver.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '106744160813738',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-comfyroll.png (ComfyRoll custom nodes)', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-comfyroll.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        // Dimensions parsed from rgthree "dimensions" string format
        width: 1024,
        height: 1024,
        model: {
          name: 'waiNSFWIllustrious_v140.safetensors',
        },
        sampling: {
          seed: '942975376742792',
          steps: 30,
          cfg: 6,
          sampler: 'euler_ancestral',
          scheduler: 'normal',
          clipSkip: 2,
        },
        // Hires detected from LatentUpscaleBy → KSampler connection pattern
        hires: {
          upscaler: 'ESRGAN-Remacri-4x.pth',
          scale: 1.5000000000000002, // from LatentUpscaleBy.scale_by
          steps: 20,
          denoise: 0.6000000000000001,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-group-nodes.png (group node IDs like "4:1")', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-group-nodes.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '1038684211150939',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-rgthree.png (rgthree Power Prompt)', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-rgthree.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '963381484256655',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-anima.png (SamplerCustomAdvanced with hires fix)', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-anima.png',
        parseComfyUI,
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt: `general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, holding sign, cowboy shot, looking at viewer, smile.\nA Beautiful and high quality anime illustrations.\nShe's holding a rectangular sign out in front of her that reads "初音ミク".\n`,
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1216,
        height: 832,
        model: {
          name: 'anima-preview.safetensors',
        },
        sampling: {
          seed: '662066908990052',
          steps: 24,
          cfg: 5,
          sampler: 'euler',
          scheduler: 'beta',
        },
        hires: {
          upscaler: 'RealESRGAN_x4plus_anime_6B.pth',
          scale: 1.5,
          steps: 14,
          denoise: 0.35000000000000003,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse krea2.png (official Krea-2 Turbo subgraph template)', () => {
      const meta = parsePngSample<ComfyUIMetadata>('krea2.png', parseComfyUI);

      expect(meta).toEqual({
        software: 'comfyui',
        // The template routes CLIPTextEncode text through ComfySwitchNode /
        // PreviewAny nodes. The LLM-enhanced prompt (TextGenerate output) is
        // not persisted, so the user's original input is extracted instead.
        prompt: '初音ミクのポートレート。美麗な2Dアニメイラスト。白背景。',
        // ConditioningZeroOut → no negative prompt
        negativePrompt: '',
        // EmptyLatentImage receives width/height via ResolutionSelector node
        // references; read() backfills real dimensions from the PNG header.
        width: 0,
        height: 0,
        model: {
          name: 'krea2_turbo_int8_convrot.safetensors',
        },
        sampling: {
          seed: '371644226245214',
          steps: 8,
          cfg: 1,
          sampler: 'euler',
          scheduler: 'simple',
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-comfyroll-lora.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-comfyroll-lora.png',
        parseComfyUI,
      );

      // CR LoRA Stack with all three slots On (model and clip weights per
      // slot); the stack is applied before a hires SamplerCustom pass
      // whose scale is the CR Integer Multiple factor, a PrimitiveFloat
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, /* テスト */',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '297361930056211',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
        },
        hires: {
          upscaler: 'ESRGAN-Remacri-4x.pth',
          scale: 1.5,
          steps: 10,
          denoise: 0.3,
        },
        loras: [
          {
            name: 'LECO_GoodHands.safetensors',
            weight: -0.7,
            clipWeight: -0.6,
          },
          { name: 'LECO_BadHands.safetensors', weight: 0.95, clipWeight: 0.92 },
          {
            name: '8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.25,
            clipWeight: 0.2,
          },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-easy-lora-stack.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-easy-lora-stack.png',
        parseComfyUI,
      );

      // easy fullLoader applies its own LoRA slot, then easy loraStack in
      // advanced mode applies num_loras (2) of its slots with separate model
      // and clip strengths. The loader also holds the prompts, the resolution
      // preset (1024 x 1024, over its 512 size inputs) and clip_skip -2
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト, /* コメント */\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '553815940690748',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          {
            name: '8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.6,
            clipWeight: 0.5,
          },
          {
            name: 'LECO_GoodHands.safetensors',
            weight: -0.9,
            clipWeight: -0.85,
          },
          { name: 'LECO_BadHands.safetensors', weight: 0.4, clipWeight: 0.2 },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-easy-lora-switcher.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-easy-lora-switcher.png',
        parseComfyUI,
      );

      // easy loraSwitcher applies only its selected slot (select: 2) with the
      // shared lora_strength and no clip weight, after the loader's own slot;
      // prompts, resolution preset and clip_skip come from the loader
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト, /* コメント */\n',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '299501584249486',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          {
            name: 'LECO_GoodHands.safetensors',
            weight: -0.8,
            clipWeight: -0.7,
          },
          { name: '8be1e5d2cc7cd938037337603fb51565.safetensors', weight: 0.8 },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-efficiency-lora.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-efficiency-lora.png',
        parseComfyUI,
      );

      // Efficient Loader applies its own slot, then the LoRA Stacker in
      // advanced mode applies lora_count (2) slots with model_str / clip_str;
      // prompts, empty latent size and clip_skip come from the loader, the
      // seed is the noise_seed of KSampler Adv. (Efficient)
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト, /* コメント */',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '865501734321328',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          {
            name: '8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.8,
            clipWeight: 0.3,
          },
          {
            name: 'LECO_GoodHands.safetensors',
            weight: -0.5,
            clipWeight: -0.4,
          },
          { name: 'LECO_BadHands.safetensors', weight: 0.8, clipWeight: 0.6 },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-lora-manager.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-lora-manager.png',
        parseComfyUI,
      );

      // Lora Loader (LoraManager): the structured `loras` list has string
      // strengths and an active flag (LECO_BadHands is inactive and left
      // out); names are written without extension
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '244827317388313',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands', weight: -0.55, clipWeight: -0.55 },
          {
            name: '8be1e5d2cc7cd938037337603fb51565',
            weight: 0.65,
            clipWeight: 0.65,
          },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-lora-model-only.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-lora-model-only.png',
        parseComfyUI,
      );

      // Three chained LoraLoaderModelOnly nodes: a model strength each, no
      // clip weight
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '1024902053740272',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands.safetensors', weight: -0.75 },
          { name: 'LECO_BadHands.safetensors', weight: 0.85 },
          { name: '8be1e5d2cc7cd938037337603fb51565.safetensors', weight: 0.3 },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-lora.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-lora.png',
        parseComfyUI,
      );

      // Three chained LoraLoader nodes in graph key order with model and
      // clip strengths
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '304694856009568',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          {
            name: 'LECO_GoodHands.safetensors',
            weight: -0.8,
            clipWeight: -0.7,
          },
          { name: 'LECO_BadHands.safetensors', weight: 0.9, clipWeight: 0.8 },
          {
            name: '8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.4,
            clipWeight: 0.2,
          },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-rgthree-lora-loader-stack.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-rgthree-lora-loader-stack.png',
        parseComfyUI,
      );

      // Lora Loader Stack (rgthree): four slots with one strength each,
      // lora_04 is None
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '762216108755372',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands.safetensors', weight: -0.4 },
          { name: 'LECO_BadHands.safetensors', weight: 0.6 },
          {
            name: '8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.35,
          },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-rgthree-lora-tag.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-rgthree-lora-tag.png',
        parseComfyUI,
      );

      // Power Prompt (rgthree) applies the <lora:...> tags of its prompt
      // text; the text itself reaches CLIPTextEncode, so the tags stay in
      // the prompt
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト, \n<lora:LECO_GoodHands:-0.5> <lora:LECO_BadHands:0.8> <lora:8be1e5d2cc7cd938037337603fb51565:0.2>',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '5081952596075',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands', weight: -0.5 },
          { name: 'LECO_BadHands', weight: 0.8 },
          { name: '8be1e5d2cc7cd938037337603fb51565', weight: 0.2 },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-rgthree-power-lora-loader.png', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'comfyui-rgthree-power-lora-loader.png',
        parseComfyUI,
      );

      // Power Lora Loader (rgthree): one object per slot with an on flag;
      // lora_2 is off and left out. The API prompt carries a single strength
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '1080288578822251',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'sgm_uniform',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          { name: 'LECO_GoodHands.safetensors', weight: -0.5 },
          { name: '8be1e5d2cc7cd938037337603fb51565.safetensors', weight: 0.4 },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });
  });

  describe('WebP samples', () => {
    it('should parse comfyui-saveimage-plus.webp', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'webp',
        'comfyui-saveimage-plus.webp',
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '453851843419278',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-save-image-extended.webp', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'webp',
        'comfyui-save-image-extended.webp',
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '602057552457611',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-animated-webp.webp', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'webp',
        'comfyui-animated-webp.webp',
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '270932924124066',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-saveimagewithmetadata.webp', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'webp',
        'comfyui-saveimagewithmetadata.webp',
      );

      expect(meta).toEqual({
        software: 'sd-webui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku,',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
          hash: '45a21ea00a',
        },
        sampling: {
          seed: '827555711811618',
          steps: 20,
          cfg: 5,
          sampler: 'Euler a',
          clipSkip: 2,
        },
      });
    });

    it('should parse comfyui-saveimagewithmetadata-lora.webp', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'webp',
        'comfyui-saveimagewithmetadata-lora.webp',
      );

      // The node writes one "Lora_N Model name / Model hash / Strength model /
      // Strength clip" group per LoRA (N from 0) and a "Hashes" JSON object;
      // the text has no tags, so the LoRAs come from those keys
      expect(meta).toEqual({
        software: 'sd-webui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v,',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
          hash: 'f116b0c78f',
        },
        sampling: {
          sampler: 'euler_ancestral_karras',
          steps: 20,
          cfg: 5,
          seed: '703968518513702',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          {
            name: '8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.4,
            clipWeight: 0.2,
            hash: '59d5706a66',
          },
          {
            name: 'LECO_BadHands.safetensors',
            weight: 0.9,
            clipWeight: 0.8,
            hash: '4c0259af91',
          },
          {
            name: 'LECO_GoodHands.safetensors',
            weight: -0.8,
            clipWeight: -0.7,
            hash: '37c4455d21',
          },
        ],
      });
    });

    it('should parse comfyui-comfy-image-saver.webp', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'webp',
        'comfyui-comfy-image-saver.webp',
      );

      expect(meta).toEqual({
        software: 'sd-webui',
        prompt: 'unknown',
        negativePrompt: 'unknown',
        width: 512,
        height: 512,
        model: {
          name: 'JANKUV5NSFWTrainedNoobai_v50',
          hash: '217daae812',
        },
        sampling: {
          seed: '0',
          steps: 20,
          cfg: 8,
          sampler: 'euler_simple',
        },
      });
    });
  });

  describe('JPEG samples', () => {
    it('should parse comfyui-saveimage-plus.jpg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'comfyui-saveimage-plus.jpg',
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '577723948579568',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-save-image-extended.jpeg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'comfyui-save-image-extended.jpeg',
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
        },
        sampling: {
          seed: '813617545434765',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
          clipSkip: 2,
        },
        hires: undefined,
        upscale: undefined,
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse comfyui-saveimagewithmetadata.jpeg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'comfyui-saveimagewithmetadata.jpeg',
      );

      expect(meta).toEqual({
        software: 'sd-webui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku,',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor,',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v160.safetensors',
          hash: '45a21ea00a',
        },
        sampling: {
          seed: '347382230306562',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral_karras',
          clipSkip: 2,
        },
      });
    });

    it('should parse comfyui-comfy-image-saver.jpeg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'comfyui-comfy-image-saver.jpeg',
      );

      expect(meta).toEqual({
        software: 'sd-webui',
        prompt: 'unknown',
        negativePrompt: 'unknown',
        width: 512,
        height: 512,
        model: {
          name: 'JANKUV5NSFWTrainedNoobai_v50',
          hash: '217daae812',
        },
        sampling: {
          seed: '0',
          steps: 20,
          cfg: 8,
          sampler: 'euler_simple',
        },
      });
    });

    it('should parse comfyui-comfy-image-saver-with-workflow.jpeg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'comfyui-comfy-image-saver-with-workflow.jpeg',
      );

      // Image Saver with embed_workflow on writes the Make/Model tag pair next
      // to its A1111-style UserComment; the node's text inputs were left
      // unwired ("unknown", Seed 0), so the graph is the source of truth,
      // including the three chained LoraLoader nodes
      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, ',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, ',
        width: 1024,
        height: 1024,
        model: {
          name: 'waiIllustriousSDXL_v170.safetensors',
        },
        sampling: {
          seed: '804396282339439',
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
        loras: [
          {
            name: 'LECO_GoodHands.safetensors',
            weight: -0.8,
            clipWeight: -0.7,
          },
          {
            name: 'LECO_BadHands.safetensors',
            weight: 0.9,
            clipWeight: 0.8,
          },
          {
            name: '8be1e5d2cc7cd938037337603fb51565.safetensors',
            weight: 0.4,
            clipWeight: 0.2,
          },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes);
    });

    it('should parse civitai-lora-hires.png (eXIf chunk)', () => {
      const meta = parsePngSample<ComfyUIMetadata>(
        'civitai-lora-hires.png',
        parseMetadata,
      );

      // The same orchestration JSON as the JPEGs, stored in an eXIf chunk.
      // This img2img hires graph has no EmptyLatentImage, so the parser
      // reports no dimensions (read() fills them from the image header).
      expect(meta).toEqual({
        software: 'civitai',
        prompt: 'perfect eyes, 1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt: 'bad quality, worst quality, 3d, jpeg artifacts,',
        width: 0,
        height: 0,
        model: {
          name: 'urn:air:sdxl:checkpoint:civitai:2904237@3284240',
        },
        sampling: {
          sampler: 'euler_ancestral',
          scheduler: 'normal',
          seed: '933381418',
          steps: 20,
          cfg: 4.5,
          denoise: 0.75,
        },
        hires: {
          upscaler: 'urn:air:other:upscaler:civitai:147759@164821',
          scale: undefined,
          steps: 20,
          denoise: 0.75,
        },
        loras: [
          {
            name: 'urn:air:sdxl:lora:civitai:1547435@1750914',
            weight: 0.4,
            clipWeight: 1,
          },
          {
            name: 'urn:air:sdxl:lora:civitai:200255@2212079',
            weight: 0.95,
            clipWeight: 1,
          },
          {
            name: 'urn:air:sdxl:lora:civitai:1826240@2066663',
            weight: 0.35,
            clipWeight: 1,
          },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes, ['extra', 'extraMetadata']);
    });

    it('should parse civitai-lora-hires.jpg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'civitai-lora-hires.jpg',
      );

      // Same orchestration graph as the eXIf PNG: three LoraLoader nodes in
      // the resource stack, named by Civitai URN with strength_clip fixed at 1
      expect(meta).toEqual({
        software: 'civitai',
        prompt: 'perfect eyes, 1girl, solo, hatsune miku, double v, #テスト',
        negativePrompt: 'bad quality, worst quality, 3d, jpeg artifacts,',
        width: 1536,
        height: 1536,
        model: {
          name: 'urn:air:sdxl:checkpoint:civitai:2904237@3284240',
        },
        sampling: {
          sampler: 'euler_ancestral',
          scheduler: 'normal',
          seed: '772182288',
          steps: 20,
          cfg: 4.5,
          denoise: 0.75,
        },
        hires: {
          upscaler: 'urn:air:other:upscaler:civitai:147759@164821',
          scale: undefined,
          steps: 20,
          denoise: 0.75,
        },
        loras: [
          {
            name: 'urn:air:sdxl:lora:civitai:1547435@1750914',
            weight: 0.4,
            clipWeight: 1,
          },
          {
            name: 'urn:air:sdxl:lora:civitai:200255@2212079',
            weight: 0.95,
            clipWeight: 1,
          },
          {
            name: 'urn:air:sdxl:lora:civitai:1826240@2066663',
            weight: 0.35,
            clipWeight: 1,
          },
        ],
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes, ['extra', 'extraMetadata']);
    });

    it('should parse civitai-hires.jpg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'civitai-hires.jpg',
      );

      expect(meta).toEqual({
        software: 'civitai',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1536,
        height: 1536,
        model: {
          name: 'urn:air:sdxl:checkpoint:civitai:827184@2514310',
        },
        sampling: {
          sampler: 'euler_ancestral',
          scheduler: 'normal',
          seed: '1311178179',
          steps: 25,
          cfg: 5,
          denoise: 0.3,
        },
        hires: {
          upscaler: 'urn:air:other:upscaler:civitai:147759@164821',
          scale: undefined,
          steps: 25,
          denoise: 0.3,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes, ['extra', 'extraMetadata']);
    });

    it('should parse civitai-upscale.jpg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'civitai-upscale.jpg',
      );

      expect(meta).toEqual({
        software: 'civitai',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1024,
        height: 1024,
        model: {
          name: 'Illustrious',
        },
        sampling: {
          sampler: 'Euler a',
          seed: '1311178179',
          steps: 25,
          cfg: 5,
        },
        upscale: {
          upscaler: 'urn:air:other:upscaler:civitai:147759@164821',
          scale: 1.5,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes, ['extra', 'extraMetadata']);
    });
  });
});
