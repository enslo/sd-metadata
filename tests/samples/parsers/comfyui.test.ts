import { describe, expect, it } from 'vitest';
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
          seed: 422847914351919,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 1116526567339338,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 511796159331902,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 434067965194649,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 779742380066441,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 38802053347333,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 106744160813738,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
        },
        hires: undefined,
        upscale: undefined,
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
          seed: 453851843419278,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 602057552457611,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 827555711811618,
          steps: 20,
          cfg: 5,
          sampler: 'Euler a',
          clipSkip: 2,
        },
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
          seed: 0,
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
          seed: 577723948579568,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 813617545434765,
          steps: 20,
          cfg: 5,
          sampler: 'euler_ancestral',
          scheduler: 'karras',
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
          seed: 347382230306562,
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
          seed: 0,
          steps: 20,
          cfg: 8,
          sampler: 'euler_simple',
        },
      });
    });

    it('should parse civitai-hires.jpg', () => {
      const meta = parseConvertedSample<ComfyUIMetadata>(
        'jpeg',
        'civitai-hires.jpg',
      );

      expect(meta).toEqual({
        software: 'comfyui',
        prompt:
          'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, #テスト',
        negativePrompt:
          'bad quality, worst quality, worst detail, sketch, censor, \n',
        width: 1536,
        height: 1536,
        model: undefined,
        sampling: {
          sampler: 'euler_ancestral',
          seed: 1311178179,
          steps: 25,
          cfg: 5,
        },
        // Note: Hires scale information is not enough in the metadata (CivitAI limitation)
        hires: undefined,
        upscale: undefined,
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
        software: 'comfyui',
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
          seed: 1311178179,
          steps: 25,
          cfg: 5,
        },
        hires: undefined,
        upscale: {
          scale: 1.5,
        },
        nodes: expect.any(Object),
      });
      expectComfyNodeGraph(meta.nodes, ['extra', 'extraMetadata']);
    });
  });
});
