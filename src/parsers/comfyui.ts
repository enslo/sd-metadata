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
  type ClassifiedNodes,
  calculateScale,
  classifyNodes,
  extractDimensions,
  extractModel,
  extractPromptTexts,
  extractSampling,
  findHiresSampler,
  isNodeReference,
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

  // Find hires sampler and resolve its sampling parameters
  const hiresSamplerNode = findHiresSampler(nodes);
  const hiresSampling = hiresSamplerNode
    ? extractSampling(nodes, hiresSamplerNode)
    : undefined;

  // Resolve hires scale from available sources
  const hiresScale = resolveHiresScale(nodes, c, width);

  const upscalerName = c.hiresModelUpscale?.inputs.model_name as
    | string
    | undefined;

  return trimObject({
    prompt: promptText || undefined,
    negativePrompt: negativeText || undefined,
    width: width > 0 ? width : undefined,
    height: height > 0 ? height : undefined,
    model: extractModel(c.checkpoint, c.unetLoader),
    sampling: extractSampling(nodes, c.sampler),
    ...buildHiresOrUpscale(upscalerName, hiresScale, hiresSampling),
  });
}

/**
 * Resolve hires scale factor from available node sources
 *
 * Priority:
 * 1. LatentUpscaleBy.scale_by (direct value)
 * 2. ImageScale.width as node reference → source node's clip_scale (rgthree)
 * 3. ImageScale.width as number → calculate ratio against base width
 */
function resolveHiresScale(
  nodes: ComfyNodeGraph,
  c: ClassifiedNodes,
  baseWidth: number,
): number | undefined {
  const latentUpscale = c.latentUpscale?.inputs;
  if (latentUpscale?.scale_by !== undefined) {
    return latentUpscale.scale_by as number;
  }

  const widthInput = c.hiresImageScale?.inputs.width;
  if (widthInput === undefined) return undefined;

  // Width from a node reference (e.g. rgthree provides scaled dimensions)
  if (isNodeReference(widthInput)) {
    const sourceNode = nodes[String(widthInput[0])];
    if (typeof sourceNode?.inputs.clip_scale === 'number') {
      return sourceNode.inputs.clip_scale;
    }
    return undefined;
  }

  // Width as direct number value
  if (typeof widthInput === 'number') {
    return calculateScale(widthInput, baseWidth);
  }

  return undefined;
}

/**
 * Build hires or upscale settings from resolved values
 *
 * @param upscalerName - Upscale model name (from UpscaleModelLoader)
 * @param scale - Pre-resolved scale factor
 * @param hiresSampling - Resolved sampling settings for hires sampler
 * @returns Hires or upscale settings
 */
function buildHiresOrUpscale(
  upscalerName: string | undefined,
  scale: number | undefined,
  hiresSampling: SamplingSettings | undefined,
): Pick<PartialMetadata, 'hires' | 'upscale'> {
  if (!upscalerName && scale === undefined && !hiresSampling) return {};

  if (hiresSampling) {
    return {
      hires: {
        upscaler: upscalerName,
        scale,
        steps: hiresSampling.steps,
        denoise: hiresSampling.denoise,
      },
    };
  }

  // Pure upscale without sampler requires upscaler model
  if (!upscalerName) return {};

  return {
    upscale: {
      upscaler: upscalerName,
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
