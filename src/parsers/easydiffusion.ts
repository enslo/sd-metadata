import type {
  InternalParseResult,
  MetadataEntry,
  StandardMetadata,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

/**
 * Easy Diffusion JSON metadata structure
 *
 * ⚠️ UNVERIFIED: This parser has not been verified with actual Easy Diffusion samples.
 * The implementation is based on reference code from other libraries but may not be
 * fully accurate. Please report any issues if you encounter problems with Easy Diffusion
 * metadata parsing.
 *
 * Easy Diffusion stores metadata as JSON in various entries:
 * - PNG: negative_prompt or Negative Prompt entry
 * - JPEG/WebP: Exif UserComment
 */
interface EasyDiffusionJsonMetadata {
  prompt?: string;
  negative_prompt?: string;
  Prompt?: string;
  'Negative Prompt'?: string;
  seed?: number;
  Seed?: number;
  use_stable_diffusion_model?: string;
  'Stable Diffusion model'?: string;
  sampler_name?: string;
  Sampler?: string;
  num_inference_steps?: number;
  Steps?: number;
  guidance_scale?: number;
  'Guidance Scale'?: number;
  width?: number;
  Width?: number;
  height?: number;
  Height?: number;
  clip_skip?: number;
  'Clip Skip'?: number;
  use_vae_model?: string;
  'VAE model'?: string;
}

/**
 * Get value from JSON with fallback for different key formats
 *
 * Easy Diffusion uses two different key formats:
 * - Format A: prompt, negative_prompt, seed (snake_case)
 * - Format B: Prompt, Negative Prompt, Seed (capitalized)
 */
function getValue<T>(
  json: EasyDiffusionJsonMetadata,
  keyA: keyof EasyDiffusionJsonMetadata,
  keyB: keyof EasyDiffusionJsonMetadata,
): T | undefined {
  return (json[keyA] ?? json[keyB]) as T | undefined;
}

/**
 * Extract model name from path
 *
 * Easy Diffusion stores full path like "path/to/model.safetensors"
 */
function extractModelName(path: string | undefined): string | undefined {
  if (!path) return undefined;
  // Handle both Windows and POSIX paths
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

/**
 * Parse Easy Diffusion metadata from entries
 *
 * Easy Diffusion stores metadata as JSON in:
 * - PNG: info dict with negative_prompt or Negative Prompt key
 * - JPEG/WebP: Exif UserComment
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseEasyDiffusion(
  entries: MetadataEntry[],
): InternalParseResult {
  const entryRecord = buildEntryRecord(entries);

  // Check for standalone entries (PNG format)
  if (entryRecord.negative_prompt || entryRecord['Negative Prompt']) {
    // The entire info dict is what we need to process
    // Try to reconstruct from individual entries or find a JSON source
    // For PNG, Easy Diffusion stores each field as a separate chunk
    return parseFromEntries(entryRecord);
  }

  // Find JSON in various possible locations
  const jsonText =
    (entryRecord.parameters?.startsWith('{')
      ? entryRecord.parameters
      : undefined) ??
    (entryRecord.UserComment?.startsWith('{')
      ? entryRecord.UserComment
      : undefined);

  if (!jsonText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  const parsed = parseJson<EasyDiffusionJsonMetadata>(jsonText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Easy Diffusion metadata',
    });
  }

  return parseFromJson(parsed.value);
}

/**
 * Parse from individual PNG entries
 */
function parseFromEntries(
  entryRecord: Record<string, string | undefined>,
): InternalParseResult {
  const prompt = entryRecord.prompt ?? entryRecord.Prompt ?? '';
  const negativePrompt =
    entryRecord.negative_prompt ??
    entryRecord['Negative Prompt'] ??
    entryRecord.negative_prompt ??
    '';

  const modelPath =
    entryRecord.use_stable_diffusion_model ??
    entryRecord['Stable Diffusion model'];

  const width = Number(entryRecord.width ?? entryRecord.Width) || 0;
  const height = Number(entryRecord.height ?? entryRecord.Height) || 0;

  const metadata: Omit<StandardMetadata, 'raw'> = {
    software: 'easydiffusion',
    prompt: prompt.trim(),
    negativePrompt: negativePrompt.trim(),
    width,
    height,
    model: {
      name: extractModelName(modelPath),
      vae: entryRecord.use_vae_model ?? entryRecord['VAE model'],
    },
    sampling: {
      sampler: entryRecord.sampler_name ?? entryRecord.Sampler,
      steps:
        Number(entryRecord.num_inference_steps ?? entryRecord.Steps) ||
        undefined,
      cfg:
        Number(entryRecord.guidance_scale ?? entryRecord['Guidance Scale']) ||
        undefined,
      seed: Number(entryRecord.seed ?? entryRecord.Seed) || undefined,
      clipSkip:
        Number(entryRecord.clip_skip ?? entryRecord['Clip Skip']) || undefined,
    },
  };

  return Result.ok(metadata);
}

/**
 * Parse from JSON object
 */
function parseFromJson(json: EasyDiffusionJsonMetadata): InternalParseResult {
  const prompt = getValue<string>(json, 'prompt', 'Prompt') ?? '';
  const negativePrompt =
    getValue<string>(json, 'negative_prompt', 'Negative Prompt') ?? '';

  const modelPath = getValue<string>(
    json,
    'use_stable_diffusion_model',
    'Stable Diffusion model',
  );

  const width = getValue<number>(json, 'width', 'Width') ?? 0;
  const height = getValue<number>(json, 'height', 'Height') ?? 0;

  const metadata: Omit<StandardMetadata, 'raw'> = {
    software: 'easydiffusion',
    prompt: prompt.trim(),
    negativePrompt: negativePrompt.trim(),
    width,
    height,
    model: {
      name: extractModelName(modelPath),
      vae: getValue<string>(json, 'use_vae_model', 'VAE model'),
    },
    sampling: {
      sampler: getValue<string>(json, 'sampler_name', 'Sampler'),
      steps: getValue<number>(json, 'num_inference_steps', 'Steps'),
      cfg: getValue<number>(json, 'guidance_scale', 'Guidance Scale'),
      seed: getValue<number>(json, 'seed', 'Seed'),
      clipSkip: getValue<number>(json, 'clip_skip', 'Clip Skip'),
    },
  };

  return Result.ok(metadata);
}
