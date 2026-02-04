/**
 * ComfyUI metadata parser
 *
 * Parses ComfyUI-format prompt data from node graphs.
 * Also handles Civitai extraMetadata fallbacks for upscale workflows.
 */

import type {
  ComfyNodeGraph,
  HiresSettings,
  InternalParseResult,
  ModelSettings,
  SamplingSettings,
  UpscaleSettings,
} from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import {
  extractCivitaiMetadata,
  extractExtraMetadata,
} from './comfyui-civitai';
import {
  calculateScale,
  classifyNodes,
  extractDimensions,
  extractModel,
  extractPromptTexts,
  extractSampling,
  findHiresSampler,
} from './comfyui-nodes';

// =============================================================================
// Constants
// =============================================================================

/**
 * CivitAI extension keys that are not ComfyUI nodes
 *
 * These keys are stored alongside nodes in JPEG format but should be
 * excluded from the nodes object to maintain type safety.
 */
const CIVITAI_EXTENSION_KEYS = ['extra', 'extraMetadata', 'resource-stack'];

// =============================================================================
// Types
// =============================================================================

/**
 * Partial metadata extracted from a single source
 *
 * All fields optional - will be merged later with other sources.
 */
interface PartialMetadata {
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: ModelSettings;
  sampling?: SamplingSettings;
  hires?: HiresSettings;
  upscale?: UpscaleSettings;
}

/**
 * Merged metadata with required base fields
 *
 * Result of merging ComfyUI and CivitAI metadata sources.
 */
interface MergedMetadata {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  model?: ModelSettings;
  sampling?: SamplingSettings;
  hires?: HiresSettings;
  upscale?: UpscaleSettings;
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse ComfyUI metadata from entries
 *
 * ComfyUI stores metadata with:
 * - prompt: JSON containing node graph with inputs
 * - workflow: JSON containing the full workflow (stored in raw, not parsed)
 *
 * This parser extracts metadata from ComfyUI nodes and merges with
 * CivitAI extraMetadata fallbacks when available.
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseComfyUI(entries: EntryRecord): InternalParseResult {
  // Find and parse prompt JSON
  const promptText = findPromptJson(entries);
  if (!promptText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const parsed = parseJson<ComfyNodeGraph>(promptText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in prompt entry',
    });
  }
  const prompt = parsed.value;

  // Verify it's ComfyUI format (has class_type)
  if (!Object.values(prompt).some((node) => 'class_type' in node)) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Extract metadata from both sources
  const comfyMetadata = extractComfyUIMetadata(prompt);
  const civitaiMetadata = extractCivitaiMetadata(
    extractExtraMetadata(prompt, entries),
  );

  // Merge with ComfyUI taking priority
  const merged = mergeMetadata(civitaiMetadata, comfyMetadata);

  return Result.ok({
    software: 'comfyui',
    // Build pure ComfyUI nodes (exclude CivitAI extensions)
    nodes: Object.fromEntries(
      Object.entries(prompt).filter(
        ([key]) => !CIVITAI_EXTENSION_KEYS.includes(key),
      ),
    ),
    ...merged,
  });
}

// =============================================================================
// JSON Utilities
// =============================================================================

/**
 * Clean JSON string for parsing
 *
 * Handles common issues in ComfyUI JSON:
 * - Remove null terminators that some tools append
 * - Replace NaN with null (NaN is not valid in JSON spec)
 */
function cleanJsonString(json: string): string {
  return json.replace(/\0+$/, '').replace(/:\s*NaN\b/g, ': null');
}

// =============================================================================
// Prompt Finding
// =============================================================================

/**
 * Find ComfyUI prompt JSON from entry record
 *
 * PNG uses 'prompt', JPEG/WebP may use Comment, Description, or Make.
 */
function findPromptJson(entryRecord: EntryRecord): string | undefined {
  // PNG format: prompt entry
  if (entryRecord.prompt) {
    return cleanJsonString(entryRecord.prompt);
  }

  // JPEG/WebP format: may be in various entries
  const candidates = [
    entryRecord.UserComment,
    entryRecord.ImageDescription,
    entryRecord.Make,
    entryRecord.Prompt, // save-image-extended uses this
    entryRecord.Workflow, // Not a prompt, but may contain nodes info
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    // Check if it's JSON that looks like ComfyUI prompt
    if (candidate.startsWith('{')) {
      const cleaned = cleanJsonString(candidate);
      const parsed = parseJson(cleaned);
      if (!parsed.ok || parsed.type !== 'object') continue;

      // Check if it's wrapped in {"prompt": {...}} format
      if (parsed.value.prompt && typeof parsed.value.prompt === 'object') {
        return JSON.stringify(parsed.value.prompt);
      }
      // Check for nodes with class_type
      const values = Object.values(parsed.value);
      if (values.some((v) => v && typeof v === 'object' && 'class_type' in v)) {
        return cleaned; // Return cleaned JSON, not original candidate
      }
    }
  }

  return undefined;
}

// =============================================================================
// ComfyUI Metadata Extraction
// =============================================================================

/**
 * Extract metadata from ComfyUI nodes
 *
 * Extracts prompt, dimensions, model, sampling, and hires settings
 * from standard ComfyUI node structure using class_type-based lookup.
 *
 * @param nodes - Parsed ComfyUI prompt (node graph)
 * @returns Partial metadata from ComfyUI nodes
 */
function extractComfyUIMetadata(
  nodes: ComfyNodeGraph,
): PartialMetadata | undefined {
  // Classify all nodes in a single pass
  const c = classifyNodes(nodes);

  // Extract from pre-classified nodes
  const { promptText, negativeText } = extractPromptTexts(nodes, c.sampler);
  const { width, height } = extractDimensions(
    c.latentImage,
    c.latentImageRgthree,
  );

  // Extract hires/upscale settings from pre-classified nodes
  const hiresModel = c.hiresModelUpscale?.inputs;
  const hiresImageScale = c.hiresImageScale?.inputs;
  const latentUpscale = c.latentUpscale?.inputs;
  const hiresSampler = findHiresSampler(nodes)?.inputs;

  return trimObject({
    prompt: promptText || undefined,
    negativePrompt: negativeText || undefined,
    width: width > 0 ? width : undefined,
    height: height > 0 ? height : undefined,
    model: extractModel(c.checkpoint),
    sampling: extractSampling(nodes, c.sampler),
    ...buildHiresOrUpscale(
      hiresModel,
      hiresImageScale,
      latentUpscale,
      hiresSampler,
      width,
    ),
  });
}

/**
 * Build hires or upscale settings from ComfyUI nodes
 *
 * @param hiresModel - Upscale model loader node inputs
 * @param hiresImageScale - Image scale node inputs (has width property)
 * @param latentUpscale - Latent upscale node inputs (has scale_by property)
 * @param hiresSampler - Hires sampler node inputs (optional)
 * @param baseWidth - Base image width for scale calculation
 * @returns Hires or upscale settings
 */
function buildHiresOrUpscale(
  hiresModel: Record<string, unknown> | undefined,
  hiresImageScale: Record<string, unknown> | undefined,
  latentUpscale: Record<string, unknown> | undefined,
  hiresSampler: Record<string, unknown> | undefined,
  baseWidth: number,
): Pick<PartialMetadata, 'hires' | 'upscale'> {
  if (!hiresModel && !hiresImageScale && !latentUpscale) return {};

  // Calculate scale from either source
  let scale: number | undefined;
  if (latentUpscale?.scale_by !== undefined) {
    // LatentUpscaleBy has direct scale value
    scale = latentUpscale.scale_by as number;
  } else if (hiresImageScale?.width !== undefined) {
    // ImageScale has target width, need to calculate ratio
    scale = calculateScale(hiresImageScale.width as number, baseWidth);
  }

  const upscaler = hiresModel?.model_name as string | undefined;

  if (hiresSampler) {
    return {
      hires: {
        upscaler,
        scale,
        steps: hiresSampler.steps as number,
        denoise: hiresSampler.denoise as number,
      },
    };
  }

  // Pure upscale without sampler requires upscaler model
  if (!upscaler) return {};

  return {
    upscale: {
      upscaler,
      scale,
    },
  };
}

// =============================================================================
// Metadata Merging
// =============================================================================

/**
 * Shallow merge two objects, skipping undefined values
 *
 * Unlike spread, undefined in override does NOT overwrite defined base values.
 * Returns undefined if result is empty.
 */
function mergeObjects<T extends object>(
  base: T | undefined,
  override: T | undefined,
): T | undefined {
  if (!base && !override) return undefined;
  const merged: Record<string, unknown> = {};
  for (const obj of [base, override]) {
    if (!obj) continue;
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) merged[k] = v;
    }
  }
  return Object.keys(merged).length > 0 ? (merged as T) : undefined;
}

/**
 * Merge two partial metadata objects
 *
 * ComfyUI metadata takes priority over CivitAI fallback.
 * Handles:
 * - Required fields: defaults to empty/zero if both undefined
 * - Optional fields: omitted if undefined (not set to undefined)
 * - Nested objects (upscale, hires): deep merge preserving defined values from both
 *
 * @param base - Base metadata (lower priority, e.g., CivitAI fallback)
 * @param override - Override metadata (higher priority, e.g., ComfyUI nodes)
 * @returns Merged metadata with required fields and optional fields
 */
function mergeMetadata(
  base: PartialMetadata | undefined,
  override: PartialMetadata | undefined,
): MergedMetadata {
  // Deep merge for nested objects (upscale, hires)
  // mergeObjects excludes undefined values, preserving defined values from both sources
  const upscale = mergeObjects(base?.upscale, override?.upscale);
  const hires = mergeObjects(base?.hires, override?.hires);

  return {
    // Required fields with defaults (override takes priority)
    prompt: override?.prompt ?? base?.prompt ?? '',
    negativePrompt: override?.negativePrompt ?? base?.negativePrompt ?? '',
    width: override?.width ?? base?.width ?? 0,
    height: override?.height ?? base?.height ?? 0,
    // Optional fields - only include if defined
    ...trimObject({
      model: override?.model ?? base?.model,
      sampling: override?.sampling ?? base?.sampling,
      hires,
      upscale,
    }),
  };
}
