import type { StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import type { InternalParseResult } from './types';

/**
 * Easy Diffusion metadata parser
 *
 * Easy Diffusion (github.com/easydiffusion/easydiffusion) writes its request
 * fields under snake_case keys:
 * - PNG: one text chunk per field (`prompt`, `seed`, `sampler_name`, ...).
 *   Values are Python `str()` renderings, so unset options appear as
 *   `"None"`, empty strings stay `""`, booleans are `"False"`/`"True"`,
 *   and lists keep their Python repr (`"['a', 'b']"`)
 * - JPEG/WebP: all fields as one JSON object in EXIF UserComment (0x9286)
 *   with native types (`null`, `false`, numbers, arrays)
 *
 * Verified against real Easy Diffusion output in `samples/`.
 */

/**
 * Values that mean "option not set"
 *
 * `"None"` is Python's `str(None)` as written to PNG chunks, `""` is an
 * empty selection (e.g. no VAE), and `"null"` is how a JSON `null` ends up
 * in a PNG chunk after our own JPEG/WebP → PNG conversion.
 */
const UNSET_VALUES = new Set(['', 'None', 'null']);

/**
 * Easy Diffusion's latent upscaler
 *
 * Unlike the other `use_upscale` choices (RealESRGAN and friends, which are
 * image post-processing), this one is a second diffusion pass over the
 * latents with its own step count (`latent_upscaler_steps`), i.e. a hires
 * fix.
 */
const LATENT_UPSCALER = 'latent_upscaler';

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
  // PNG: each field is a separate text chunk
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
  // Optional setting: undefined when missing, not a string, or unset
  const opt = (key: string): string | undefined => {
    const v = str(key);
    return v === undefined || UNSET_VALUES.has(v) ? undefined : v;
  };
  const num = (key: string): number | undefined => {
    const v = Number(data[key]);
    return v || undefined;
  };

  const prompt = (str('prompt') ?? '').trim();
  const negativePrompt = (str('negative_prompt') ?? '').trim();
  const modelPath = opt('use_stable_diffusion_model');

  // Easy Diffusion's clip_skip is a boolean; when set, sdkit takes CLIP's
  // penultimate hidden states, which is what A1111 calls "Clip skip: 2".
  // A plain number (not something Easy Diffusion writes) is taken as-is.
  const clipSkip =
    data.clip_skip === true || data.clip_skip === 'True'
      ? 2
      : typeof data.clip_skip === 'boolean'
        ? undefined
        : num('clip_skip');

  // Upscaling (unset unless chosen): the latent upscaler is a hires pass,
  // everything else is post-generation image upscaling
  const upscaler = opt('use_upscale');
  const hires =
    upscaler === LATENT_UPSCALER
      ? trimObject({
          scale: num('upscale_amount'),
          upscaler,
          steps: num('latent_upscaler_steps'),
        })
      : undefined;
  const upscale =
    upscaler && upscaler !== LATENT_UPSCALER
      ? trimObject({ upscaler, scale: num('upscale_amount') })
      : undefined;

  const metadata: StandardMetadata = {
    software: 'easydiffusion',
    prompt,
    negativePrompt,
    width: num('width') ?? 0,
    height: num('height') ?? 0,
    model: trimObject({
      name: extractModelName(modelPath),
      vae: opt('use_vae_model'),
    }),
    sampling: trimObject({
      sampler: opt('sampler_name'),
      scheduler: opt('scheduler_name'),
      steps: num('num_inference_steps'),
      cfg: num('guidance_scale'),
      // Seed 0 means unset (same rule as num()); otherwise keep the exact text
      seed: num('seed') === undefined ? undefined : toSeedString(data.seed),
      clipSkip,
      denoise: num('prompt_strength'),
    }),
    ...(hires ? { hires } : {}),
    ...(upscale ? { upscale } : {}),
  };

  return Result.ok(metadata);
}
