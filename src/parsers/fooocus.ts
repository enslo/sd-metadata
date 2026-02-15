import type { InternalParseResult, StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';

/**
 * Fooocus JSON metadata structure
 *
 * ⚠️ UNVERIFIED: This parser has not been verified with actual Fooocus samples.
 * The implementation is based on source code analysis of Fooocus
 * (github.com/lllyasviel/Fooocus). Please report any issues if you encounter
 * problems with Fooocus metadata parsing.
 *
 * Fooocus uses the "fooocus" metadata scheme which embeds JSON in:
 * - PNG: `parameters` tEXt chunk
 * - JPEG/WebP: EXIF UserComment (0x9286)
 */
interface FooocusJsonMetadata {
  prompt?: string;
  negative_prompt?: string;
  resolution?: string;
  base_model?: string;
  base_model_hash?: string;
  vae?: string;
  sampler?: string;
  scheduler?: string;
  seed?: number;
  guidance_scale?: number;
  steps?: number;
  clip_skip?: number;
}

/**
 * Parse resolution string "(W, H)" into width and height
 *
 * Fooocus stores resolution as a Python tuple string, e.g., "(1024, 1024)".
 *
 * @param resolution - Resolution string in format "(width, height)"
 * @returns Parsed dimensions or { width: 0, height: 0 } on failure
 */
function parseResolution(resolution: string | undefined): {
  width: number;
  height: number;
} {
  if (!resolution) return { width: 0, height: 0 };

  const match = resolution.match(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!match?.[1] || !match[2]) return { width: 0, height: 0 };

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

/**
 * Parse Fooocus JSON metadata from entries
 *
 * Reads from `parameters` (PNG) or `UserComment` (JPEG/WebP).
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseFooocus(entries: EntryRecord): InternalParseResult {
  const jsonText = entries.parameters ?? entries.UserComment;

  if (!jsonText || !jsonText.startsWith('{')) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const parsed = parseJson<FooocusJsonMetadata>(jsonText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Fooocus metadata',
    });
  }
  const json = parsed.value;

  const { width, height } = parseResolution(json.resolution);

  const metadata: StandardMetadata = {
    software: 'fooocus',
    prompt: json.prompt?.trim() ?? '',
    negativePrompt: json.negative_prompt?.trim() ?? '',
    width,
    height,
    model: trimObject({
      name: json.base_model,
      hash: json.base_model_hash,
      vae: json.vae,
    }),
    sampling: trimObject({
      sampler: json.sampler,
      scheduler: json.scheduler,
      steps: json.steps,
      cfg: json.guidance_scale,
      seed: json.seed,
      clipSkip: json.clip_skip,
    }),
  };

  return Result.ok(metadata);
}
