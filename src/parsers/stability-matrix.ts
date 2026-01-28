import type { InternalParseResult, MetadataEntry } from '../types';
import { Result } from '../types';
import { buildEntryRecord, extractFromCommentJson } from '../utils/entries';
import { parseJson } from '../utils/json';
import { parseComfyUI } from './comfyui';

/**
 * Stability Matrix parameters-json structure
 */
interface StabilityMatrixJson {
  PositivePrompt?: string;
  NegativePrompt?: string;
  Width?: number;
  Height?: number;
  Seed?: number;
  Steps?: number;
  CfgScale?: number;
  Sampler?: string;
  ModelName?: string;
  ModelHash?: string;
}

/**
 * Parse Stability Matrix metadata from entries
 *
 * Stability Matrix stores metadata with:
 * - prompt: ComfyUI-compatible workflow JSON (primary source)
 * - parameters-json: JSON containing generation parameters
 *   - Used to override prompts (more complete than workflow)
 * - parameters: A1111-style text (fallback)
 * - smproj: Project data (not parsed here)
 *
 * Strategy:
 * 1. Parse as ComfyUI workflow (workflow, model, sampling, etc.)
 * 2. Override prompts from parameters-json (more complete)
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseStabilityMatrix(
  entries: MetadataEntry[],
): InternalParseResult {
  // Build entry record for easy access
  const entryRecord = buildEntryRecord(entries);

  // First, parse as ComfyUI workflow to get base metadata
  const comfyResult = parseComfyUI(entries);
  if (!comfyResult.ok || comfyResult.value.software !== 'comfyui') {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Find parameters-json entry for prompt/model override
  // PNG: stored in 'parameters-json' chunk
  // JPEG/WebP (after conversion): stored in 'Comment' as {"parameters-json": ..., ...}
  const jsonText =
    entryRecord['parameters-json'] ??
    extractFromCommentJson(entryRecord, 'parameters-json');
  const parsed = jsonText
    ? parseJson<StabilityMatrixJson>(jsonText)
    : undefined;
  const data = parsed?.ok ? parsed.value : undefined;

  return Result.ok({
    ...comfyResult.value,
    software: 'stability-matrix',
    // Override prompts from parameters-json (more complete than workflow)
    prompt: data?.PositivePrompt ?? comfyResult.value.prompt,
    negativePrompt: data?.NegativePrompt ?? comfyResult.value.negativePrompt,
    // Override model if either name or hash is provided
    model:
      data?.ModelName !== undefined || data?.ModelHash !== undefined
        ? { name: data?.ModelName, hash: data?.ModelHash }
        : comfyResult.value.model,
  });
}
