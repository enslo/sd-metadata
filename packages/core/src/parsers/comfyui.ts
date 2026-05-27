/**
 * ComfyUI metadata parser
 *
 * Parses ComfyUI-format prompt data from node graphs.
 * Also handles Civitai extraMetadata fallbacks for upscale workflows.
 */

import type { BaseMetadata, ComfyNodeGraph, SamplingSettings } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import {
  extractCivitaiMetadata,
  extractExtraMetadata,
} from './comfyui-civitai';
import { flatScanComfyMetadata } from './comfyui-flat-scan';
import {
  type ClassifiedNodes,
  calculateScale,
  classifyNodes,
  extractClipSkip,
  extractDimensions,
  extractModel,
  extractPromptTexts,
  extractSampling,
  findHiresSampler,
  isNodeReference,
} from './comfyui-nodes';
import type { InternalParseResult, PartialMetadata } from './types';

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
    // ComfyUI workflow-only chunk: UI state JSON without an accompanying
    // API "prompt" graph. The UI workflow format (nodes as an array, values
    // packed into positional `widgets_values`) is structurally incompatible
    // with the extractor, so we cannot recover prompts or settings. We still
    // surface the image as ComfyUI with empty fields so software detection
    // and the raw view work — interpretation is intentionally given up.
    if (hasWorkflowOnlyChunk(entries)) {
      return Result.ok({
        software: 'comfyui',
        nodes: {},
        prompt: '',
        negativePrompt: '',
        width: 0,
        height: 0,
      });
    }
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

  // Extract metadata from all sources and merge in priority order.
  // Higher index = higher priority. Flat scan is the brute-force fallback
  // that catches custom-node and non-standard topology cases the structured
  // parser cannot resolve; CivitAI extraMetadata fills any remaining gaps;
  // the structured ComfyUI walk is most trustworthy when it succeeds.
  const final = mergeMetadata(
    flatScanComfyMetadata(prompt),
    extractCivitaiMetadata(extractExtraMetadata(prompt, entries)),
    extractComfyUIMetadata(prompt),
  );

  return Result.ok({
    software: 'comfyui',
    // Build pure ComfyUI nodes (exclude CivitAI extensions)
    nodes: Object.fromEntries(
      Object.entries(prompt).filter(
        ([key]) => !CIVITAI_EXTENSION_KEYS.includes(key),
      ),
    ),
    ...final,
  });
}

// =============================================================================
// Denoise Normalization
// =============================================================================

/**
 * Strip denoise from sampling when it equals the default (1.0)
 *
 * denoise = 1.0 means full denoising (txt2img default) and is not meaningful
 * to store. Only non-default values (< 1.0, e.g. img2img / hires fix) are
 * kept in the output.
 */
function normalizeDenoise(
  sampling: SamplingSettings | undefined,
): SamplingSettings | undefined {
  if (!sampling || typeof sampling.denoise !== 'number') return sampling;
  if (sampling.denoise >= 1) {
    const { denoise: _, ...rest } = sampling;
    return rest;
  }
  return sampling;
}

// =============================================================================
// JSON Utilities
// =============================================================================

/**
 * Clean JSON string for parsing
 *
 * Handles common issues in ComfyUI JSON:
 * - Remove null terminators that some tools append
 * - Replace NaN with null at any JSON value position (NaN is not valid in
 *   JSON spec). Matches NaN preceded by ":", "," or "[" so it covers both
 *   object values ({"k": NaN}) and array elements ([NaN], [1, NaN]),
 *   without touching the literal substring "NaN" inside quoted strings.
 */
function cleanJsonString(json: string): string {
  return json.replace(/\0+$/, '').replace(/([:,[])\s*NaN\b/g, '$1null');
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

/**
 * Detect a ComfyUI workflow-only chunk
 *
 * Some ComfyUI saves embed only the UI-state "workflow" JSON without the
 * companion API "prompt" graph. The UI workflow JSON has a distinctive
 * shape: a top-level `nodes` array (vs. the prompt format where each node
 * lives under a numeric-string key in a flat object). We use this signature
 * to identify the image as ComfyUI even though we cannot parse the workflow.
 */
function hasWorkflowOnlyChunk(entryRecord: EntryRecord): boolean {
  for (const candidate of [entryRecord.workflow, entryRecord.Workflow]) {
    if (!candidate?.startsWith('{')) continue;
    const parsed = parseJson(cleanJsonString(candidate));
    if (
      parsed.ok &&
      parsed.type === 'object' &&
      Array.isArray(parsed.value.nodes)
    ) {
      return true;
    }
  }
  return false;
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
export function extractComfyUIMetadata(
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
  const hiresSampling = normalizeDenoise(
    hiresSamplerNode ? extractSampling(nodes, hiresSamplerNode) : undefined,
  );

  // Resolve hires scale from available sources
  const hiresScale = resolveHiresScale(nodes, c, width);

  const upscalerName = c.hiresModelUpscale?.inputs.model_name as
    | string
    | undefined;

  const rawSampling = normalizeDenoise(extractSampling(nodes, c.sampler));
  const clipSkip = extractClipSkip(c.clipSetLastLayer);

  return trimObject({
    prompt: promptText || undefined,
    negativePrompt: negativeText || undefined,
    width: width > 0 ? width : undefined,
    height: height > 0 ? height : undefined,
    model: extractModel(c.checkpoint, c.unetLoader),
    sampling: trimObject({ ...rawSampling, clipSkip }),
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
 * Shallow merge any number of objects, skipping undefined values.
 *
 * Later sources take priority over earlier ones (undefined in a later source
 * does NOT overwrite a defined value from an earlier one). Returns undefined
 * if the result would be empty.
 */
function mergeObjects<T extends object>(
  ...sources: (T | undefined)[]
): T | undefined {
  const merged: Record<string, unknown> = {};
  for (const obj of sources) {
    if (!obj) continue;
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) merged[k] = v;
    }
  }
  return Object.keys(merged).length > 0 ? (merged as T) : undefined;
}

/**
 * Merge any number of partial metadata sources by priority.
 *
 * Later arguments win over earlier ones. For scalar fields (prompt,
 * negativePrompt, width, height), the highest-priority *truthy* value is
 * picked — so an empty string or zero from a higher-priority source does
 * not mask a usable value from a lower one. Nested objects (model,
 * sampling, hires, upscale) are merged field-by-field via {@link mergeObjects}
 * so partial coverage from each source is preserved.
 *
 * @param sources - Partial metadata in increasing priority order
 * @returns Merged base metadata with required fields defaulted
 */
function mergeMetadata(
  ...sources: (PartialMetadata | undefined)[]
): BaseMetadata {
  // Highest-priority first iteration: pick the first truthy value found.
  const reversed = [...sources].reverse();
  const pick = <K extends keyof PartialMetadata>(
    key: K,
  ): PartialMetadata[K] | undefined => reversed.find((s) => s?.[key])?.[key];

  return {
    prompt: pick('prompt') ?? '',
    negativePrompt: pick('negativePrompt') ?? '',
    width: pick('width') ?? 0,
    height: pick('height') ?? 0,
    ...trimObject({
      model: mergeObjects(...sources.map((s) => s?.model)),
      sampling: mergeObjects(...sources.map((s) => s?.sampling)),
      hires: mergeObjects(...sources.map((s) => s?.hires)),
      upscale: mergeObjects(...sources.map((s) => s?.upscale)),
    }),
  };
}
