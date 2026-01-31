/**
 * CivitAI extraMetadata handling for ComfyUI parser
 *
 * CivitAI stores original generation parameters in an extraMetadata field
 * when images are upscaled through their orchestration service.
 */

import type {
  ComfyNodeGraph,
  HiresSettings,
  ModelSettings,
  SamplingSettings,
  UpscaleSettings,
} from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';

// =============================================================================
// Types
// =============================================================================

/**
 * Civitai extraMetadata structure (nested JSON in prompt)
 */
export interface CivitaiExtraMetadata {
  prompt?: string;
  negativePrompt?: string;
  cfgScale?: number;
  sampler?: string;
  clipSkip?: number;
  steps?: number;
  seed?: number;
  width?: number;
  height?: number;
  baseModel?: string;
  transformations?: Array<{
    type?: string;
    upscaleWidth?: number;
    upscaleHeight?: number;
  }>;
}

/**
 * Partial metadata extracted from CivitAI extraMetadata
 */
export interface CivitaiPartialMetadata {
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: ModelSettings;
  sampling?: SamplingSettings;
  hires?: HiresSettings;
  upscale?: UpscaleSettings;
}

// =============================================================================
// Extraction
// =============================================================================

/**
 * Extract extraMetadata from ComfyUI prompt or entryRecord
 *
 * Civitai upscale workflows embed original generation params in extraMetadata field.
 * This can be:
 * 1. Inside the prompt JSON (JPEG format: single JSON with all data)
 * 2. As a separate entry (PNG format: extraMetadata as separate chunk)
 */
export function extractExtraMetadata(
  prompt: ComfyNodeGraph,
  entryRecord?: EntryRecord,
): CivitaiExtraMetadata | undefined {
  // First try to find extraMetadata inside the prompt (JPEG format)
  const extraMetaField = prompt.extraMetadata;
  if (typeof extraMetaField === 'string') {
    const parsed = parseJson<CivitaiExtraMetadata>(extraMetaField);
    if (parsed.ok && parsed.type === 'object') return parsed.value;
  }

  // Fall back to separate entry (PNG format)
  if (entryRecord?.extraMetadata) {
    const parsed = parseJson<CivitaiExtraMetadata>(entryRecord.extraMetadata);
    if (parsed.ok && parsed.type === 'object') return parsed.value;
  }

  return undefined;
}

/**
 * Extract metadata from CivitAI extraMetadata (fallback source)
 *
 * Used when ComfyUI nodes don't contain the expected data
 * (e.g., upscale-only workflows from Civitai).
 *
 * @param extraMeta - CivitAI extraMetadata
 * @returns Partial metadata from CivitAI extraMetadata
 */
export function extractCivitaiMetadata(
  extraMeta: CivitaiExtraMetadata | undefined,
): CivitaiPartialMetadata | undefined {
  if (!extraMeta) return undefined;

  const upscale = buildCivitaiUpscale(extraMeta);
  const sampling = buildCivitaiSampling(extraMeta);

  return trimObject({
    prompt: extraMeta.prompt,
    negativePrompt: extraMeta.negativePrompt,
    width: extraMeta.width,
    height: extraMeta.height,
    model: extraMeta.baseModel ? { name: extraMeta.baseModel } : undefined,
    ...sampling,
    ...upscale,
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate scale factor rounded to 2 decimal places
 */
function calculateScale(
  targetWidth: number,
  baseWidth: number,
): number | undefined {
  if (baseWidth <= 0 || targetWidth <= 0) return undefined;
  return Math.round((targetWidth / baseWidth) * 100) / 100;
}

/**
 * Build upscale settings from CivitAI transformations
 *
 * CivitAI stores upscale information in extraMetadata.transformations array.
 * This extracts the upscale transformation and calculates the scale factor.
 */
function buildCivitaiUpscale(
  extraMeta: CivitaiExtraMetadata,
): Pick<CivitaiPartialMetadata, 'upscale'> {
  if (!extraMeta.transformations) return {};

  const upscaleTransform = extraMeta.transformations.find(
    (t) => t.type === 'upscale',
  );
  if (!upscaleTransform?.upscaleWidth) return {};

  const scale = calculateScale(
    upscaleTransform.upscaleWidth,
    extraMeta.width ?? 0,
  );
  if (scale === undefined) return {};

  return {
    upscale: { scale },
  };
}

/**
 * Build sampling settings from CivitAI extraMetadata
 *
 * Only creates sampling object if at least one field is defined.
 */
function buildCivitaiSampling(
  extraMeta: CivitaiExtraMetadata,
): Pick<CivitaiPartialMetadata, 'sampling'> {
  if (
    extraMeta.seed === undefined &&
    extraMeta.steps === undefined &&
    extraMeta.cfgScale === undefined &&
    extraMeta.sampler === undefined
  ) {
    return {};
  }

  return {
    sampling: {
      seed: extraMeta.seed,
      steps: extraMeta.steps,
      cfg: extraMeta.cfgScale,
      sampler: extraMeta.sampler,
    },
  };
}
