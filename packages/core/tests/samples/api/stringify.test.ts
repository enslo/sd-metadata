import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatRaw, stringify } from '../../../src/api/stringify';
import { read } from '../../../src/index';

const loadSample = (format: 'png' | 'jpg' | 'webp', filename: string) => {
  const filePath = path.join(
    __dirname,
    `../../../../../samples/${format}`,
    filename,
  );
  return fs.readFileSync(filePath);
};

describe('formatRaw - Samples', () => {
  describe('GIMP samples (unrecognized metadata)', () => {
    it('should format gimp.png', () => {
      const data = loadSample('png', 'gimp.png');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('GIMPで再保存しただけ');
      }
    });

    it('should format gimp-en.png', () => {
      const data = loadSample('png', 'gimp-en.png');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('Created with GIMP');
      }
    });

    it('should format gimp.jpg', () => {
      const data = loadSample('jpg', 'gimp.jpg');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('GIMPで再保存しただけ');
      }
    });

    it('should format gimp.webp', () => {
      const data = loadSample('webp', 'gimp.webp');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toBe('GIMPで再保存しただけ');
      }
    });
  });

  describe('AI-generated samples (success metadata)', () => {
    it('should format raw metadata from novelai-curated.png', () => {
      const data = loadSample('png', 'novelai-curated.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toContain('hatsune miku');
        expect(formatted.length).toBeGreaterThan(0);
      }
    });

    it('should format raw metadata from comfyui.png', () => {
      const data = loadSample('png', 'comfyui.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const formatted = formatRaw(result.raw);
        expect(formatted).toContain('CheckpointLoader');
        expect(formatted).toContain('KSampler');
        expect(formatted.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('stringify - Samples', () => {
  // A1111-style text is returned as the tool wrote it (line endings
  // normalized), so keys the parser does not model survive
  describe('A1111 text samples (transcribed)', () => {
    it('should keep the Version key and blank lines of sd-webui.png', () => {
      const result = read(loadSample('png', 'sd-webui.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト\n\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor, \n\nSteps: 20, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 7, Seed: 3782896554, Size: 1024x1024, Model hash: 45a21ea00a, Model: waiIllustriousSDXL_v160, Version: v1.10.1',
      );
    });

    it('should keep the RNG and Version keys of the forge-classic-hires.jpeg UserComment', () => {
      const result = read(loadSample('jpg', 'forge-classic-hires.jpeg'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, テスト\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor, \nSteps: 20, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 6, Seed: 3452054396, Size: 1024x1024, Model hash: 45a21ea00a, Model: waiIllustriousSDXL_v160, Denoising strength: 0.3, RNG: CPU, Hires upscale: 1.5, Hires steps: 10, Hires upscaler: ESRGAN-UltraSharp-4x, Version: classic',
      );
    });

    it('should keep the tags and Lora hashes of forge-classic-lora.png as written', () => {
      const result = read(loadSample('png', 'forge-classic-lora.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, テスト\n <lora:LECO_GoodHands:-0.8> <lora:LECO_BadHands:0.8> <lora:Smooth_Booster_v5:0.1:0.5>\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor,\nSteps: 20, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 6, Seed: 4155927651, Size: 1024x1024, Model hash: c9b4dab236, Model: waiNSFWIllustrious_v140, RNG: CPU, Lora hashes: "LECO_GoodHands: fe3806374a03, LECO_BadHands: 37c8880f409c, Smooth_Booster_v5: c121dd957230", Version: classic',
      );
    });

    it('should keep Civitai resources and Civitai metadata of civitai-lora.jpg, escapes included', () => {
      const result = read(loadSample('jpg', 'civitai-lora.jpg'));

      expect(stringify(result)).toBe(
        'perfect eyes, 1girl, solo, hatsune miku, double v, #テスト\nNegative prompt: bad quality, worst quality, 3d, jpeg artifacts,\nSteps: 20, Sampler: Euler a, CFG scale: 4.5, Seed: 667264311, Size: 1024x1024, Clip skip: 2, Created Date: 2026-10-26T14:45:38.7110751Z, Civitai resources: [{"type":"checkpoint","modelVersionId":3284240,"modelName":"WAI-Simple-Illustrious","modelVersionName":"v1.0"},{"type":"lora","weight":0.95,"modelVersionId":2212079,"modelName":"Hands XL \\u002B SD 1.5 \\u002B F1D \\u002B Pony \\u002B Illustrious \\u002B zit \\u002B ZIB","modelVersionName":"Hands Illu v1.1"},{"type":"lora","weight":0.4,"modelVersionId":1750914,"modelName":"Detailed anime style - Illustrious V2.0","modelVersionName":"v0.7"},{"type":"lora","weight":0.35,"modelVersionId":2066663,"modelName":"Eyes for Illustrious Lora (Perfect anime eyes)","modelVersionName":"V1"}], Civitai metadata: {"workflow":"txt2img","priority":"low","outputFormat":"jpeg","aspectRatio":{"value":"1:1","width":1024,"height":1024},"prompt":"perfect eyes, 1girl, solo, hatsune miku, double v, #テスト","negativePrompt":"bad quality, worst quality, 3d, jpeg artifacts,","sampler":"Euler a","cfgScale":4.5,"steps":20,"clipSkip":2,"seed":667264311,"enhancedCompatibility":false,"quantity":1,"resources":[{"modelVersionId":3284240,"strength":1,"type":"Checkpoint"},{"modelVersionId":1750914,"strength":0.4,"type":"LORA"},{"modelVersionId":2212079,"strength":0.95,"type":"LORA"},{"modelVersionId":2066663,"strength":0.35,"type":"LORA"}]}',
      );
    });

    it('should return the eXIf UserComment of civitai-lora.png', () => {
      const result = read(loadSample('png', 'civitai-lora.png'));

      expect(stringify(result)).toBe(
        'perfect eyes, 1girl, solo, hatsune miku, double v, #テスト\nNegative prompt: bad quality, worst quality, 3d, jpeg artifacts,\nSteps: 20, Sampler: Euler a, CFG scale: 4.5, Seed: 1070944611, Size: 1024x1024, Clip skip: 2, Created Date: 2026-10-26T14:47:39.3012937Z, Civitai resources: [{"type":"checkpoint","modelVersionId":3284240,"modelName":"WAI-Simple-Illustrious","modelVersionName":"v1.0"},{"type":"lora","weight":0.35,"modelVersionId":2066663,"modelName":"Eyes for Illustrious Lora (Perfect anime eyes)","modelVersionName":"V1"},{"type":"lora","weight":0.4,"modelVersionId":1750914,"modelName":"Detailed anime style - Illustrious V2.0","modelVersionName":"v0.7"},{"type":"lora","weight":0.95,"modelVersionId":2212079,"modelName":"Hands XL \\u002B SD 1.5 \\u002B F1D \\u002B Pony \\u002B Illustrious \\u002B zit \\u002B ZIB","modelVersionName":"Hands Illu v1.1"}], Civitai metadata: {"workflow":"txt2img","priority":"low","outputFormat":"png","aspectRatio":{"value":"1:1","width":1024,"height":1024},"prompt":"perfect eyes, 1girl, solo, hatsune miku, double v, #テスト","negativePrompt":"bad quality, worst quality, 3d, jpeg artifacts,","sampler":"Euler a","cfgScale":4.5,"steps":20,"clipSkip":2,"seed":1070944611,"enhancedCompatibility":false,"quantity":1,"resources":[{"modelVersionId":3284240,"strength":1,"type":"Checkpoint"},{"modelVersionId":1750914,"strength":0.4,"type":"LORA"},{"modelVersionId":2212079,"strength":0.95,"type":"LORA"},{"modelVersionId":2066663,"strength":0.35,"type":"LORA"}]}',
      );
    });

    it('should keep the Fooocus keys (Raw prompt, Lora weights) of fooocus-a1111.png', () => {
      const result = read(loadSample('png', 'fooocus-a1111.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, 1girl, solo, hatsune miku, double v, #テスト, general, masterpiece, best quality, amazing quality, very detailed, highly consistent, innocent colors, beautiful, epic, stunning, gorgeous, cinematic, dramatic ambient light, professional, winning, artistic, clear, complex, appealing, novel, cool, color, awesome, perfect, focus, creative, positive, joyful, unique, cute, nice, attractive, marvelous, pure\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor\nSteps: 60, Sampler: DPM++ 2M SDE Karras, Seed: 4575475577937763433, Size: 1024x1024, CFG scale: 4, Sharpness: 2, ADM Guidance: "(1.5, 0.8, 0.3)", Model: waiIllustriousSDXL_v170, Model hash: 45add30a71, Performance: Quality, Scheduler: karras, VAE: Default (model), Raw prompt: "general, masterpiece, best quality, amazing quality\\n1girl, solo, hatsune miku, double v, #テスト", Raw negative prompt: "bad quality, worst quality, worst detail, sketch, censor", Clip skip: 2, Lora hashes: "LECO_GoodHands: ba19c53aee, LECO_BadHands: d63dde547c, 8be1e5d2cc7cd938037337603fb51565: fed2ff2ef9", Lora weights: "LECO_GoodHands: -0.38, LECO_BadHands: 0.33, 8be1e5d2cc7cd938037337603fb51565: 0.31", Version: Fooocus v2.5.5',
      );
    });

    it('should keep the Lora_N keys of comfyui-saveimagewithmetadata-lora.webp', () => {
      const result = read(
        loadSample('webp', 'comfyui-saveimagewithmetadata-lora.webp'),
      );

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, \nNegative prompt: bad quality, worst quality, worst detail, sketch, censor, \nSteps: 20, Sampler: euler_ancestral_karras, CFG scale: 5.0, Seed: 703968518513702, Size: 1024x1024, Model: waiIllustriousSDXL_v170.safetensors, Model hash: f116b0c78f, Lora_0 Model name: 8be1e5d2cc7cd938037337603fb51565.safetensors, Lora_0 Model hash: 59d5706a66, Lora_0 Strength model: 0.4, Lora_0 Strength clip: 0.2, Lora_1 Model name: LECO_BadHands.safetensors, Lora_1 Model hash: 4c0259af91, Lora_1 Strength model: 0.9, Lora_1 Strength clip: 0.8, Lora_2 Model name: LECO_GoodHands.safetensors, Lora_2 Model hash: 37c4455d21, Lora_2 Strength model: -0.8, Lora_2 Strength clip: -0.7, Hashes: {"model": "f116b0c78f", "lora:8be1e5d2cc7cd938037337603fb51565": "59d5706a66", "lora:LECO_BadHands": "4c0259af91", "lora:LECO_GoodHands": "37c4455d21"}',
      );
    });
  });

  // Other sources are rebuilt from the metadata: LoRAs become tags at the
  // end of the prompt plus Lora hashes, or Civitai resources for CivitAI
  describe('rebuilt samples with LoRAs', () => {
    it('should write two-value tags (clip first) for comfyui-lora.png', () => {
      const result = read(loadSample('png', 'comfyui-lora.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, <lora:LECO_GoodHands:-0.7:-0.8> <lora:LECO_BadHands:0.8:0.9> <lora:8be1e5d2cc7cd938037337603fb51565:0.2:0.4>\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor, \nSteps: 20, Sampler: euler_ancestral, Schedule type: karras, CFG scale: 5, Seed: 304694856009568, Size: 1024x1024, Model: waiIllustriousSDXL_v170.safetensors',
      );
    });

    it('should write the clip weight of 1 of stability-matrix-lora.png', () => {
      const result = read(loadSample('png', 'stability-matrix-lora.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, #テスト <lora:LECO_GoodHands:1:-0.8> <lora:LECO_BadHands:1:0.9> <lora:8be1e5d2cc7cd938037337603fb51565:1:0.4>\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor, \nSteps: 20, Sampler: euler_ancestral, Schedule type: karras, CFG scale: 5, Seed: 395309383, Size: 1024x1024, Model hash: F116B0C78FF441467B0CDC8F1936E1ED18EA31E9997C7B132B1B8DB533F0BD04, Model: waiIllustriousSDXL_v170.safetensors',
      );
    });

    it('should write the sha256 Lora hashes of swarmui-lora.png', () => {
      const result = read(loadSample('png', 'swarmui-lora.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, #テスト <lora:8be1e5d2cc7cd938037337603fb51565:0.6> <lora:LECO_BadHands:-0.5> <lora:LECO_GoodHands:0.6>\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor, \nSteps: 20, CFG scale: 4.5, Seed: 555551940, Size: 1024x1024, Model: waiIllustriousSDXL_v170, Lora hashes: "8be1e5d2cc7cd938037337603fb51565: 0x9af2184c4a387752c4d86440598b0ea059257165ae0c71a683e4f5fcc16b0050, LECO_BadHands: 0x3ad0c6f3d319419328965c058b40f5d230dcb1145e4c0b8951100f5e68002099, LECO_GoodHands: 0xc5a540231a576a044587c37f1fe704390587a07303313d7f0612382d08606925"',
      );
    });

    it('should write the blake3 Lora hashes of invokeai-lora.png', () => {
      const result = read(loadSample('png', 'invokeai-lora.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, #テスト\n<lora:LECO_GoodHands:-0.8> <lora:LECO_BadHands:0.75> <lora:8be1e5d2cc7cd938037337603fb51565:0.45>\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor, \n\nSteps: 20, Sampler: dpmpp_3m_k, CFG scale: 5, Seed: 3955673604, Size: 1024x1024, Model hash: blake3:5a694d07c5f371b902bfa04622af80d4e7e1fa0e633b798c1f03d7d1252548d7, Model: waiIllustriousSDXL_v170, Lora hashes: "LECO_GoodHands: blake3:bfd3808a9c2bcb186b648487dbdc4dce47a596cdda97b9f20a445baf1305516f, LECO_BadHands: blake3:4478c707e0e89c250c0897388782b9c926103e9ebbd93f241a1e9c3d0d6d69bf, 8be1e5d2cc7cd938037337603fb51565: blake3:4d12a16bec8fdc0be69ac1ccea9077104f0d61156e21b79a9b09419418c52626"',
      );
    });

    it('should keep the dotted name of tensorart-lora.png', () => {
      const result = read(loadSample('png', 'tensorart-lora.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, xiushou, \n1girl, solo, hatsune miku, double v, #テスト /* コメント */ <lora:lora.by_tusi:0.2> <lora:lighting_v2:0.4> <lora:Detail_enhancer_IL_v2:0.25>\nNegative prompt: bad quality, worst quality, worst detail, sketch,censor, \nSteps: 20, Sampler: euler_ancestral, Schedule type: sgm_uniform, CFG scale: 5, Seed: 890135287, Size: 1024x1024, Model hash: F116B0C78FF441467B0CDC8F1936E1ED18EA31E9997C7B132B1B8DB533F0BD04, Model: WAI-Nsfw-Illustrious-17, Clip skip: 2, Lora hashes: "lora.by_tusi: FCE04DA765FEFD716AAB4CA967D51D1E8B20E35DC9486C1C14C9A187320130CC, lighting_v2: F79B58EA61E84430559638FD1A0D93B6F995F7F08CB7D8541D44FA392D027D63, Detail_enhancer_IL_v2: 54A203F0A909FDC9B1D74F29FD5A16E33387A824D7D2161322F4DB3EA250455E"',
      );
    });

    it('should write stems for the Lora\\\\ paths of ruined-fooocus-lora.png and hash only the hashed one', () => {
      const result = read(loadSample('png', 'ruined-fooocus-lora.png'));

      expect(stringify(result)).toBe(
        'general, masterpiece, best quality, amazing quality, \n1girl, solo, hatsune miku, double v, #テスト <lora:LECO_GoodHands:0.05> <lora:LECO_BadHands:0.65> <lora:8be1e5d2cc7cd938037337603fb51565:0.75>\nNegative prompt: bad quality, worst quality, worst detail, sketch, censor,\nSteps: 30, Sampler: dpmpp_2m_sde_gpu, Schedule type: karras, CFG scale: 8, Seed: 1794310204, Size: 1024x1024, Model: waiIllustriousSDXL_v170.safetensors, Clip skip: 1, Lora hashes: "8be1e5d2cc7cd938037337603fb51565: FED2FF2EF9C09C5F01732F051CB8F1C9A00FCA8655E0DA43BD4EBB3F2706517F"',
      );
    });

    it('should write tags and Lora hashes, not Lora weights, for the JSON scheme of fooocus.png', () => {
      const result = read(loadSample('png', 'fooocus.png'));

      expect(stringify(result)).toBe(
        'watercolor painting general, masterpiece, best quality, amazing quality . vibrant, beautiful, painterly, detailed, textural, artistic, kawaii style general, masterpiece, best quality, amazing quality . cute, adorable, brightly colored, cheerful, anime influence, highly detailed, 1girl, solo, hatsune miku, double v, #テスト <lora:LECO_GoodHands:-0.48> <lora:LECO_BadHands:0.77> <lora:8be1e5d2cc7cd938037337603fb51565:0.65>\nNegative prompt: anime, photorealistic, 35mm film, deformed, glitch, low contrast, noisy, dark, scary, realistic, monochrome, abstract, bad quality, worst quality, worst detail, sketch, censor\nSteps: 30, Sampler: dpmpp_2m_sde_gpu, Schedule type: karras, CFG scale: 4, Seed: 7100816951239959675, Size: 1024x1024, Model hash: 45add30a71, Model: waiIllustriousSDXL_v170, Clip skip: 2, Lora hashes: "LECO_GoodHands: ba19c53aee, LECO_BadHands: d63dde547c, 8be1e5d2cc7cd938037337603fb51565: fed2ff2ef9"',
      );
    });

    it('should write stems for the .ckpt names of draw-things-lora.png', () => {
      const result = read(loadSample('png', 'draw-things-lora.png'));

      expect(stringify(result)).toBe(
        '1girl, hatsune miku, holding sign that reads "初音ミク", masterpiece, best quality, very aesthetic, absurdres, safe <lora:surprised_look_slider_lora_f16:0.3> <lora:dmd2_sdxl_4_step_lora_f16:0.7>\nSteps: 8, Sampler: LCM, CFG scale: 1.4, Seed: 1656867057, Size: 1024x1024, Model: animagine_xl_v3.1_f16.ckpt',
      );
    });

    it('should write Civitai resources from the URNs of civitai-lora-hires.png, without tags', () => {
      const result = read(loadSample('png', 'civitai-lora-hires.png'));

      expect(stringify(result)).toBe(
        'perfect eyes, 1girl, solo, hatsune miku, double v, #テスト\nNegative prompt: bad quality, worst quality, 3d, jpeg artifacts,\nSteps: 20, Sampler: euler_ancestral, Schedule type: normal, CFG scale: 4.5, Seed: 933381418, Size: 1536x1536, Model: urn:air:sdxl:checkpoint:civitai:2904237@3284240, Denoising strength: 0.75, Hires steps: 20, Hires upscaler: urn:air:other:upscaler:civitai:147759@164821, Civitai resources: [{"type":"lora","weight":0.4,"modelId":1547435,"modelVersionId":1750914},{"type":"lora","weight":0.95,"modelId":200255,"modelVersionId":2212079},{"type":"lora","weight":0.35,"modelId":1826240,"modelVersionId":2066663}]',
      );
    });
  });

  describe('rebuilt samples (stringify(result) === stringify(result.metadata))', () => {
    it('should stringify novelai PNG', () => {
      const data = loadSample('png', 'novelai-curated.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(stringify(result.metadata));
      }
    });

    it('should stringify comfyui PNG', () => {
      const data = loadSample('png', 'comfyui.png');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(stringify(result.metadata));
      }
    });

    it('should stringify novelai WebP', () => {
      const data = loadSample('webp', 'novelai-curated.webp');
      const result = read(data);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(stringify(result)).toBe(stringify(result.metadata));
      }
    });
  });

  describe('unrecognized samples (should match formatRaw)', () => {
    it('should stringify gimp.png', () => {
      const data = loadSample('png', 'gimp.png');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        expect(stringify(result)).toBe(formatRaw(result.raw));
      }
    });

    it('should stringify gimp.jpg', () => {
      const data = loadSample('jpg', 'gimp.jpg');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        expect(stringify(result)).toBe(formatRaw(result.raw));
      }
    });

    it('should stringify gimp.webp', () => {
      const data = loadSample('webp', 'gimp.webp');
      const result = read(data);

      expect(result.status).toBe('unrecognized');
      if (result.status === 'unrecognized') {
        expect(stringify(result)).toBe(formatRaw(result.raw));
      }
    });
  });

  describe('empty samples', () => {
    it('should return empty string for empty.png', () => {
      const data = loadSample('png', 'empty.png');
      const result = read(data);

      expect(result.status).toBe('empty');
      expect(stringify(result)).toBe('');
    });

    it('should return empty string for empty.jpg', () => {
      const data = loadSample('jpg', 'empty.jpg');
      const result = read(data);

      expect(result.status).toBe('empty');
      expect(stringify(result)).toBe('');
    });

    it('should return empty string for empty.webp', () => {
      const data = loadSample('webp', 'empty.webp');
      const result = read(data);

      expect(result.status).toBe('empty');
      expect(stringify(result)).toBe('');
    });
  });
});
