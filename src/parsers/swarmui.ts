import type {
  InternalParseResult,
  MetadataEntry,
  SwarmUIMetadata,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

/**
 * SwarmUI parameters JSON structure
 */
interface SwarmUIParameters {
  sui_image_params?: {
    prompt?: string;
    negativeprompt?: string;
    model?: string;
    seed?: number;
    steps?: number;
    cfgscale?: number;
    width?: number;
    height?: number;
    sampler?: string;
    scheduler?: string;
    // Refiner/Upscale settings
    refinerupscale?: number;
    refinerupscalemethod?: string;
    refinercontrolpercentage?: number;
  };
}

/**
 * Parse SwarmUI metadata from entries
 *
 * SwarmUI stores metadata with:
 * - parameters: JSON containing sui_image_params
 * - prompt: ComfyUI-style node graph (fallback)
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseSwarmUI(entries: MetadataEntry[]): InternalParseResult {
  // Build entry record for easy access
  const entryRecord = buildEntryRecord(entries);

  // Find parameters entry (PNG uses 'parameters', JPEG/WebP uses 'Comment')
  const parametersText = entryRecord.parameters ?? entryRecord.Comment;
  if (!parametersText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse parameters JSON
  const parsed = parseJson<SwarmUIParameters>(parametersText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in parameters entry',
    });
  }

  // Verify SwarmUI format (has sui_image_params)
  const params = parsed.value.sui_image_params;
  if (!params) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = params.width ?? 0;
  const height = params.height ?? 0;

  // Build metadata
  const metadata: Omit<SwarmUIMetadata, 'raw'> = {
    type: 'swarmui',
    software: 'swarmui',
    prompt: params.prompt ?? '',
    negativePrompt: params.negativeprompt ?? '',
    width,
    height,
  };

  // Add model settings
  if (params.model) {
    metadata.model = {
      name: params.model,
    };
  }

  // Add sampling settings
  if (
    params.seed !== undefined ||
    params.steps !== undefined ||
    params.cfgscale !== undefined ||
    params.sampler !== undefined ||
    params.scheduler !== undefined
  ) {
    metadata.sampling = {
      seed: params.seed,
      steps: params.steps,
      cfg: params.cfgscale,
      sampler: params.sampler,
      scheduler: params.scheduler,
    };
  }

  // Add hires/upscale settings
  if (
    params.refinerupscale !== undefined ||
    params.refinerupscalemethod !== undefined ||
    params.refinercontrolpercentage !== undefined
  ) {
    metadata.hires = {
      scale: params.refinerupscale,
      upscaler: params.refinerupscalemethod,
      denoise: params.refinercontrolpercentage,
    };
  }

  return Result.ok(metadata);
}
