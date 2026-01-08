import type { ParseResult, PngTextChunk, SwarmUIMetadata } from '../types';
import { Result } from '../types';

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
 * Parse SwarmUI metadata from PNG chunks
 *
 * SwarmUI stores metadata in tEXt chunks:
 * - parameters: JSON containing sui_image_params
 * - prompt: ComfyUI-style node graph (fallback)
 *
 * @param chunks - PNG text chunks
 * @returns Parsed metadata or error
 */
export function parseSwarmUI(chunks: PngTextChunk[]): ParseResult {
  // Find parameters chunk
  const parametersChunk = chunks.find((c) => c.keyword === 'parameters');
  if (!parametersChunk) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse parameters JSON
  let data: SwarmUIParameters;
  try {
    data = JSON.parse(parametersChunk.text);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in parameters chunk',
    });
  }

  // Verify SwarmUI format (has sui_image_params)
  const params = data.sui_image_params;
  if (!params) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = params.width ?? 0;
  const height = params.height ?? 0;

  // Build metadata
  const metadata: SwarmUIMetadata = {
    type: 'swarmui',
    software: 'swarmui',
    prompt: params.prompt ?? '',
    negativePrompt: params.negativeprompt ?? '',
    width,
    height,
    raw: chunks,
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
