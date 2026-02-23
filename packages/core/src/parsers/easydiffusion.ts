import type { StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import type { InternalParseResult } from './types';

/**
 * Easy Diffusion metadata parser
 *
 * ⚠️ UNVERIFIED: This parser has not been verified with actual Easy Diffusion samples.
 * The implementation is based on source code analysis of Easy Diffusion
 * (github.com/easydiffusion/easydiffusion). Please report any issues if you encounter
 * problems with Easy Diffusion metadata parsing.
 *
 * Easy Diffusion stores metadata using snake_case keys:
 * - PNG: Each field as a separate tEXt chunk (e.g., `prompt`, `seed`, `sampler_name`)
 * - JPEG/WebP: All fields as JSON in EXIF UserComment (0x9286)
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
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseEasyDiffusion(entries: EntryRecord): InternalParseResult {
  // PNG: each field is a separate tEXt chunk
  if ('use_stable_diffusion_model' in entries) {
    return buildMetadata(entries);
  }

  // JPEG/WebP: all fields as JSON in UserComment (or parameters for conversion cases)
  const jsonText = entries.UserComment?.startsWith('{')
    ? entries.UserComment
    : entries.parameters?.startsWith('{')
      ? entries.parameters
      : undefined;

  if (!jsonText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

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
 * Handles both PNG entries (string values) and parsed JSON (typed values).
 * All keys use snake_case format matching Easy Diffusion's internal naming.
 */
function buildMetadata(data: Record<string, unknown>): InternalParseResult {
  const str = (key: string): string | undefined => {
    const v = data[key];
    return typeof v === 'string' ? v : undefined;
  };
  const num = (key: string): number | undefined => {
    const v = Number(data[key]);
    return v || undefined;
  };

  const prompt = (str('prompt') ?? '').trim();
  const negativePrompt = (str('negative_prompt') ?? '').trim();
  const modelPath = str('use_stable_diffusion_model');

  // Upscale settings (post-processing, only present when upscaler is used)
  const upscale = trimObject({
    upscaler: str('use_upscale'),
    scale: num('upscale_amount'),
  });

  const metadata: StandardMetadata = {
    software: 'easydiffusion',
    prompt,
    negativePrompt,
    width: num('width') ?? 0,
    height: num('height') ?? 0,
    model: trimObject({
      name: extractModelName(modelPath),
      vae: str('use_vae_model'),
    }),
    sampling: trimObject({
      sampler: str('sampler_name'),
      steps: num('num_inference_steps'),
      cfg: num('guidance_scale'),
      seed: num('seed'),
      clipSkip: num('clip_skip'),
      denoise: num('prompt_strength'),
    }),
    ...(upscale ? { upscale } : {}),
  };

  return Result.ok(metadata);
}
