import type { InternalParseResult } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

/**
 * Easy Diffusion JSON metadata structure (for documentation)
 *
 * UNVERIFIED: This parser has not been verified with actual Easy Diffusion samples.
 * The implementation is based on reference code from other libraries but may not be
 * fully accurate. Please report any issues if you encounter problems with Easy Diffusion
 * metadata parsing.
 *
 * Easy Diffusion uses two different key formats:
 * - Format A (snake_case): prompt, negative_prompt, seed, use_stable_diffusion_model, ...
 * - Format B (capitalized): Prompt, Negative Prompt, Seed, Stable Diffusion model, ...
 *
 * Easy Diffusion stores metadata as JSON in various entries:
 * - PNG: negative_prompt or Negative Prompt entry
 * - JPEG/WebP: Exif UserComment
 */

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
export function parseEasyDiffusion(entries: EntryRecord): InternalParseResult {
  // Check for standalone entries (PNG format)
  if (entries.negative_prompt || entries['Negative Prompt']) {
    return buildMetadata(entries);
  }

  // Find JSON in various possible locations
  const jsonText = entries.parameters?.startsWith('{')
    ? entries.parameters
    : entries.UserComment?.startsWith('{') && entries.UserComment;

  if (!jsonText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  const parsed = parseJson<Record<string, unknown>>(jsonText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Easy Diffusion metadata',
    });
  }

  return buildMetadata(parsed.value);
}

/**
 * Build metadata from a key-value record
 *
 * Handles both PNG entries (string values) and parsed JSON (typed values)
 * by using dual-key lookup (snake_case and Capitalized formats).
 */
function buildMetadata(data: Record<string, unknown>): InternalParseResult {
  const str = (keyA: string, keyB: string): string | undefined => {
    const v = data[keyA] ?? data[keyB];
    return typeof v === 'string' ? v : undefined;
  };
  const num = (keyA: string, keyB: string): number | undefined => {
    const v = Number(data[keyA] ?? data[keyB]);
    return v || undefined;
  };

  const prompt = (str('prompt', 'Prompt') ?? '').trim();
  const negativePrompt = (
    str('negative_prompt', 'Negative Prompt') ?? ''
  ).trim();
  const modelPath = str('use_stable_diffusion_model', 'Stable Diffusion model');

  return Result.ok({
    software: 'easydiffusion',
    prompt,
    negativePrompt,
    width: num('width', 'Width') ?? 0,
    height: num('height', 'Height') ?? 0,
    model: {
      name: extractModelName(modelPath),
      vae: str('use_vae_model', 'VAE model'),
    },
    sampling: {
      sampler: str('sampler_name', 'Sampler'),
      steps: num('num_inference_steps', 'Steps'),
      cfg: num('guidance_scale', 'Guidance Scale'),
      seed: num('seed', 'Seed'),
      clipSkip: num('clip_skip', 'Clip Skip'),
    },
  });
}
