import type { ComfyNodeGraph, InternalParseResult } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';

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
 * Extract SwarmUI parameters from entry record
 *
 * Checks direct 'parameters' entry first, then tries to extract from Comment JSON.
 * After converter fix, Comment JSON contains direct sui_image_params (native WebP format).
 */
function extractSwarmUIParameters(
  entryRecord: Record<string, string | undefined>,
): string | undefined {
  // Direct parameters entry (PNG format)
  if (entryRecord.parameters) {
    return entryRecord.parameters;
  }

  // Try to extract from UserComment JSON (JPEG/WebP format)
  if (!entryRecord.UserComment) {
    return undefined;
  }

  const commentParsed = parseJson<Record<string, unknown>>(
    entryRecord.UserComment,
  );
  if (!commentParsed.ok) {
    return undefined;
  }

  // Native WebP format: direct sui_image_params
  if ('sui_image_params' in commentParsed.value) {
    return entryRecord.UserComment; // Return as-is to preserve full structure
  }

  return undefined;
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
export function parseSwarmUI(entries: EntryRecord): InternalParseResult {
  // Find parameters entry
  // For PNG: direct keyword 'parameters'
  // For JPEG/WebP: inside Comment JSON
  const parametersText = extractSwarmUIParameters(entries);

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

  // Parse nodes from prompt chunk (PNG format) or Make field (JPEG/WebP extended format)
  const promptSource = entries.prompt || entries.Make;
  const promptParsed = promptSource ? parseJson(promptSource) : undefined;
  const nodes = promptParsed?.ok
    ? (promptParsed.value as ComfyNodeGraph)
    : undefined;

  return Result.ok({
    software: 'swarmui',
    prompt: params.prompt ?? '',
    negativePrompt: params.negativeprompt ?? '',
    width,
    height,
    nodes,
    model: trimObject({ name: params.model }),
    sampling: trimObject({
      seed: params.seed,
      steps: params.steps,
      cfg: params.cfgscale,
      sampler: params.sampler,
      scheduler: params.scheduler,
    }),
    hires: trimObject({
      scale: params.refinerupscale,
      upscaler: params.refinerupscalemethod,
      denoise: params.refinercontrolpercentage,
    }),
  });
}
