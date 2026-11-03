import { describe, expect, it } from 'vitest';
import {
  type GenerationMetadata,
  parse,
  parseVideo,
  stringify,
  type VideoParseResult,
  type VideoTag,
} from '../../src/index';
import { loadVideoSample } from '../helpers/samples';

const WAN_PROMPT =
  'A girl looks directly at the camera and smiles warmly, then quickly winks her left eye while keeping the other eye open. Subtle natural head movement. Static camera, close-up, soft lighting.';
const WAN_NEGATIVE =
  '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走';
const MMH3_PROMPT =
  'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.\n\nintegrated_multimodal_description: [Shot 1] Hatsune Miku turns to the camera, smiles, and winks.\n\noverall_soundscape: N/A\n\nnon_diegetic_music: N/A';

/**
 * ComfyUI Wan 2.2 image-to-video template, saved by core SaveVideo. Two
 * KSamplerAdvanced stages run the high-noise model with its LoRA, then the
 * low-noise model with its own; the first stage is reported (as Forge Neo
 * does), so model and LoRA are both high-noise.
 */
const comfyWan = (seed: string) => ({
  software: 'comfyui',
  prompt: WAN_PROMPT,
  negativePrompt: WAN_NEGATIVE,
  width: 512,
  height: 512,
  model: { name: 'wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors' },
  // steps / cfg come through ComfySwitchNode (#301)
  sampling: { seed, sampler: 'euler', scheduler: 'simple', steps: 4, cfg: 1 },
  loras: [
    {
      name: 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors',
      // written as 1.0000000000000002 by ComfyUI's frontend
      weight: 1,
    },
  ],
});

/**
 * ComfyUI MiniMax H3 graph, saved by VideoHelperSuite's Video Combine. The
 * prompt is read through BasicGuider; the size comes from the video track,
 * since the graph resolves it in a ResolutionSelector node.
 */
const comfyMmh3 = (seed: string) => ({
  software: 'comfyui',
  prompt: MMH3_PROMPT,
  negativePrompt: '',
  width: 736,
  height: 736,
  model: { name: 'minimax_h3_ref2va_pruned_int8_convrot.safetensors' },
  sampling: { sampler: 'euler', seed, steps: 8, scheduler: 'beta' },
  loras: [
    {
      name: 'minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors',
      weight: 1,
    },
  ],
});

/** Forge Neo's A1111 text, as MP4 `desc` / Matroska `DESCRIPTION`. */
const forgeNeo = (seed: string) => ({
  software: 'forge-neo',
  prompt: `${WAN_PROMPT} \n<lora:wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise:1>`,
  negativePrompt: '',
  width: 512,
  height: 512,
  model: { name: 'wan2.2_i2v_high_noise_14B_fp8_scaled', hash: '6122e79d55' },
  sampling: { sampler: 'Euler', scheduler: 'Simple', steps: 4, cfg: 1, seed },
  loras: [{ name: 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise', weight: 1 }],
  hires: { denoise: 1 },
});

/** Generation-metadata samples: expected metadata and raw tags. */
const SUCCESS_SAMPLES = [
  {
    dir: 'mp4',
    file: 'comfyui-wan2.2.mp4',
    metadata: comfyWan('943507712392230'),
    tags: ['workflow:mdta', 'prompt:mdta', 'encoder:mdta'],
  },
  {
    dir: 'webm',
    file: 'comfyui-wan2.2.webm',
    metadata: comfyWan('643177897804252'),
    tags: ['WORKFLOW:matroska', 'PROMPT:matroska', 'ENCODER:matroska'],
  },
  {
    dir: 'mkv',
    file: 'comfyui-wan2.2.mkv',
    metadata: comfyWan('643969713869583'),
    tags: ['WORKFLOW:matroska', 'PROMPT:matroska', 'ENCODER:matroska'],
  },
  {
    dir: 'mp4',
    file: 'comfyui-mmh3.mp4',
    metadata: comfyMmh3('768914106098754'),
    tags: [
      'major_brand:mdta',
      'minor_version:mdta',
      'compatible_brands:mdta',
      'workflow:mdta',
      'prompt:mdta',
      'encoder:mdta',
    ],
  },
  {
    dir: 'webm',
    file: 'comfyui-mmh3.webm',
    metadata: comfyMmh3('778529764803468'),
    tags: ['WORKFLOW:matroska', 'PROMPT:matroska', 'ENCODER:matroska'],
  },
  {
    dir: 'mp4',
    file: 'forge-neo-wan2.2.mp4',
    metadata: forgeNeo('1563198298'),
    tags: ['©too:itunes', 'desc:itunes'],
  },
  {
    dir: 'mkv',
    file: 'forge-neo-wan2.2.mkv',
    metadata: forgeNeo('1547901027'),
    tags: ['DESCRIPTION:matroska', 'ENCODER:matroska'],
  },
] as const;

const FORMATS = { mp4: 'mp4', webm: 'webm', mkv: 'mkv' } as const;

/** The generation fields compared (the ComfyUI node graph is left out). */
function summarize(metadata: GenerationMetadata) {
  const { software, prompt, negativePrompt, width, height } = metadata;
  return {
    software,
    prompt,
    negativePrompt,
    width,
    height,
    ...(metadata.model ? { model: metadata.model } : {}),
    ...(metadata.sampling ? { sampling: metadata.sampling } : {}),
    ...(metadata.loras ? { loras: metadata.loras } : {}),
    ...(metadata.hires ? { hires: metadata.hires } : {}),
    ...(metadata.upscale ? { upscale: metadata.upscale } : {}),
  };
}

const tagShape = (tags: VideoTag[]) => tags.map((t) => `${t.key}:${t.source}`);

function expectSuccess(result: VideoParseResult) {
  if (result.status !== 'success') throw new Error(result.status);
  return result;
}

/**
 * A Blob that records how many bytes are read from it, through ranges
 * (`slice`) or whole (`arrayBuffer` / `bytes` / `text` / `stream`), to check
 * that only metadata is read.
 */
class CountingBlob extends Blob {
  bytesRead = 0;
  override slice(start?: number, end?: number, type?: string): Blob {
    const part = super.slice(start, end, type);
    this.bytesRead += part.size;
    return part;
  }
  override arrayBuffer(): Promise<ArrayBuffer> {
    this.bytesRead += this.size;
    return super.arrayBuffer();
  }
  override bytes(): Promise<Uint8Array<ArrayBuffer>> {
    this.bytesRead += this.size;
    return super.bytes();
  }
  override text(): Promise<string> {
    this.bytesRead += this.size;
    return super.text();
  }
  override stream(): ReadableStream<Uint8Array<ArrayBuffer>> {
    this.bytesRead += this.size;
    return super.stream();
  }
}

describe('parseVideo - generation metadata', () => {
  for (const sample of SUCCESS_SAMPLES) {
    it(`${sample.file} -> ${sample.metadata.software}`, async () => {
      const result = expectSuccess(
        await parseVideo(loadVideoSample(sample.dir, sample.file)),
      );

      expect(summarize(result.metadata)).toEqual(sample.metadata);
      expect(result.raw.format).toBe(FORMATS[sample.dir]);
      expect(tagShape(result.raw.tags)).toEqual(sample.tags);
    });
  }

  it('returns the Forge Neo text as written from stringify()', async () => {
    const result = await parseVideo(
      loadVideoSample('mp4', 'forge-neo-wan2.2.mp4'),
    );
    const desc = expectSuccess(result).raw.tags.find((t) => t.key === 'desc');
    expect(stringify(result)).toBe(desc?.value);
  });

  it('rebuilds A1111 text for ComfyUI from stringify()', async () => {
    const result = await parseVideo(
      loadVideoSample('mp4', 'comfyui-wan2.2.mp4'),
    );
    expect(stringify(result)).toMatch(/^A girl looks directly at the camera/);
    expect(stringify(result)).toContain('Steps: 4');
  });

  it('keeps metadata dimensions only, with strict', async () => {
    const result = expectSuccess(
      await parseVideo(loadVideoSample('mp4', 'comfyui-mmh3.mp4'), {
        strict: true,
      }),
    );
    expect(result.metadata.width).toBe(0);
    expect(result.metadata.height).toBe(0);
  });
});

describe('parseVideo - vendor videos', () => {
  const VENDOR_SAMPLES = [
    {
      file: 'gemini-veo3.1-lite.mp4',
      info: { vendor: 'google', source: 'c2pa', media: 'video' },
      text: 'Google Veo',
    },
    {
      // Also carries xAI's ©cmt signature; C2PA wins.
      file: 'grok-imagine2.mp4',
      info: {
        vendor: 'xai',
        product: 'Grok Imagine',
        source: 'c2pa',
        media: 'video',
      },
      text: 'xAI Grok Imagine',
    },
    {
      // The XMP packet sits in a uuid box after the media data.
      file: 'muse.mp4',
      info: { vendor: 'meta', source: 'xmp', media: 'video' },
      text: 'Meta Muse',
    },
  ] as const;

  for (const { file, info, text } of VENDOR_SAMPLES) {
    it(`${file} -> ${text}`, async () => {
      const result = await parseVideo(loadVideoSample('vendor/mp4', file));
      expect(result).toEqual({ status: 'vendor', info });
      expect(stringify(result)).toBe(text);
    });
  }
});

describe('parseVideo - files without metadata', () => {
  it('comfyui-mmh3-no-metadata.mp4 (ffmpeg tags only) is empty', async () => {
    const result = await parseVideo(
      loadVideoSample('mp4', 'comfyui-mmh3-no-metadata.mp4'),
    );
    expect(result).toEqual({ status: 'empty' });
  });

  // Video Combine has no save_metadata switch for ProRes, so this MOV only
  // carries ffmpeg's QuickTime ©swr text item.
  it('comfyui-mmh3.mov (Video Combine ProRes) is empty', async () => {
    const result = await parseVideo(loadVideoSample('mov', 'comfyui-mmh3.mov'));
    expect(result).toEqual({ status: 'empty' });
  });
});

describe('parseVideo - Blob input', () => {
  const ALL = [
    ...SUCCESS_SAMPLES.map(({ dir, file }) => ({ dir, file })),
    { dir: 'mp4', file: 'comfyui-mmh3-no-metadata.mp4' },
    { dir: 'mov', file: 'comfyui-mmh3.mov' },
    { dir: 'vendor/mp4', file: 'gemini-veo3.1-lite.mp4' },
    { dir: 'vendor/mp4', file: 'grok-imagine2.mp4' },
    { dir: 'vendor/mp4', file: 'muse.mp4' },
  ];

  for (const { dir, file } of ALL) {
    it(`${file}: same result as bytes, reading only metadata`, async () => {
      const bytes = loadVideoSample(dir, file);
      const blob = new CountingBlob([new Uint8Array(bytes)]);

      expect(await parseVideo(blob)).toEqual(await parseVideo(bytes));
      // Metadata is at most a few tens of KB here; the media data is not read.
      expect(blob.bytesRead).toBeLessThan(Math.min(bytes.length / 2, 200_000));
    });
  }
});

describe('parse() given a video', () => {
  it('points to parseVideo()', async () => {
    const result = await parse(loadVideoSample('mp4', 'comfyui-wan2.2.mp4'));
    expect(result).toEqual({
      status: 'invalid',
      message: 'Video files are read with parseVideo()',
    });
  });
});
