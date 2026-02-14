import type { InternalParseResult, StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

/**
 * Fooocus JSON metadata structure
 *
 * ⚠️ UNVERIFIED: This parser has not been verified with actual Fooocus samples.
 * The implementation is based on reference code from other libraries but may not be
 * fully accurate. Please report any issues if you encounter problems with Fooocus
 * metadata parsing.
 *
 * Fooocus stores metadata as JSON in:
 * - PNG: Comment chunk
 * - JPEG: comment field
 */
interface FooocusJsonMetadata {
  prompt?: string;
  negative_prompt?: string;
  base_model?: string;
  refiner_model?: string;
  sampler?: string;
  scheduler?: string;
  seed?: number;
  cfg?: number;
  steps?: number;
  width?: number;
  height?: number;
  loras?: Array<{ name: string; weight: number }>;
  style_selection?: string[];
  performance?: string;
}

/**
 * Parse Fooocus metadata from entries
 *
 * Fooocus stores metadata as JSON in the Comment chunk (PNG) or
 * comment field (JPEG).
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseFooocus(entries: EntryRecord): InternalParseResult {
  // Find JSON in Comment entry (PNG uses Comment, JPEG uses comment)
  const jsonText = entries.Comment ?? entries.comment;

  if (!jsonText || !jsonText.startsWith('{')) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  const parsed = parseJson<FooocusJsonMetadata>(jsonText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Fooocus metadata',
    });
  }
  const json = parsed.value;

  const metadata: Omit<StandardMetadata, 'raw'> = {
    software: 'fooocus',
    prompt: json.prompt?.trim() ?? '',
    negativePrompt: json.negative_prompt?.trim() ?? '',
    width: json.width ?? 0,
    height: json.height ?? 0,
    model: {
      name: json.base_model,
    },
    sampling: {
      sampler: json.sampler,
      scheduler: json.scheduler,
      steps: json.steps,
      cfg: json.cfg,
      seed: json.seed,
    },
  };

  return Result.ok(metadata);
}
