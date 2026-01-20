import type {
  InternalParseResult,
  MetadataEntry,
  StandardMetadata,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

/**
 * Ruined Fooocus JSON metadata structure
 *
 * Ruined Fooocus stores metadata as JSON in the `parameters` chunk.
 * It has a `software` field set to "RuinedFooocus" for identification.
 */
interface RuinedFooocusJsonMetadata {
  Prompt?: string;
  Negative?: string;
  steps?: number;
  cfg?: number;
  width?: number;
  height?: number;
  seed?: number;
  sampler_name?: string;
  scheduler?: string;
  base_model_name?: string;
  base_model_hash?: string;
  loras?: Array<{ name: string; weight: number }>;
  clip_skip?: number;
  software?: string;
}

/**
 * Parse Ruined Fooocus metadata from entries
 *
 * Ruined Fooocus stores metadata as JSON in the `parameters` chunk,
 * with a `software` field set to "RuinedFooocus".
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseRuinedFooocus(
  entries: MetadataEntry[],
): InternalParseResult {
  const entryRecord = buildEntryRecord(entries);

  // Find JSON in parameters entry
  const jsonText = entryRecord.parameters;

  if (!jsonText || !jsonText.startsWith('{')) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  const parsed = parseJson<RuinedFooocusJsonMetadata>(jsonText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Ruined Fooocus metadata',
    });
  }
  const json = parsed.value;

  // Verify it's Ruined Fooocus format
  if (json.software !== 'RuinedFooocus') {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const metadata: Omit<StandardMetadata, 'raw'> = {
    software: 'ruined-fooocus',
    prompt: json.Prompt?.trim() ?? '',
    negativePrompt: json.Negative?.trim() ?? '',
    width: json.width ?? 0,
    height: json.height ?? 0,
    model: {
      name: json.base_model_name,
      hash: json.base_model_hash,
    },
    sampling: {
      sampler: json.sampler_name,
      scheduler: json.scheduler,
      steps: json.steps,
      cfg: json.cfg,
      seed: json.seed,
      clipSkip: json.clip_skip,
    },
  };

  return Result.ok(metadata);
}
