/**
 * ComfyUI metadata parser
 *
 * Parses ComfyUI-format prompt data from node graphs.
 * Also handles Civitai extraMetadata fallbacks for upscale workflows.
 */

import type {
  ComfyNode,
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

// =============================================================================
// Types
// =============================================================================

/**
 * CivitAI extension keys that are not ComfyUI nodes
 *
 * These keys are stored alongside nodes in JPEG format but should be
 * excluded from the nodes object to maintain type safety.
 */
const CIVITAI_EXTENSION_KEYS = ['extra', 'extraMetadata', 'resource-stack'];

/**
 * ComfyUI node type keys for metadata extraction
 *
 * These keys identify specific node types in the ComfyUI node graph.
 * Arrays allow matching multiple node type variants.
 */
const COMFYUI_NODE_KEYS = {
  sampler: ['Sampler'],
  positiveClip: ['PositiveCLIP_Base'],
  negativeClip: ['NegativeCLIP_Base'],
  latentImage: ['EmptyLatentImage'],
  checkpoint: ['CheckpointLoader_Base'],
  hiresModelUpscale: [
    'HiresFix_ModelUpscale_UpscaleModelLoader',
    'PostUpscale_ModelUpscale_UpscaleModelLoader',
  ],
  hiresImageScale: ['HiresFix_ImageScale', 'PostUpscale_ImageScale'],
  hiresSampler: ['HiresFix_Sampler'],
} as const;

/**
 * Civitai extraMetadata structure (nested JSON in prompt)
 */
interface CivitaiExtraMetadata {
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

  // Build pure ComfyUI nodes (exclude CivitAI extensions)
  const nodes: ComfyNodeGraph = Object.fromEntries(
    Object.entries(prompt).filter(
      ([key]) => !CIVITAI_EXTENSION_KEYS.includes(key),
    ),
  ) as ComfyNodeGraph;

  // Extract metadata from both sources
  const comfyMetadata = extractComfyUIMetadata(prompt);
  const civitaiMetadata = extractCivitaiMetadata(
    extractExtraMetadata(prompt, entries),
  );

  // Merge with ComfyUI taking priority
  const merged = mergeMetadata(civitaiMetadata, comfyMetadata);

  return Result.ok({
    software: 'comfyui',
    nodes,
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

/**
 * Calculate scale factor rounded to 2 decimal places
 *
 * @param targetWidth - Target width after scaling
 * @param baseWidth - Original base width
 * @returns Scale factor or undefined if invalid inputs
 */
function calculateScale(
  targetWidth: number,
  baseWidth: number,
): number | undefined {
  if (baseWidth <= 0 || targetWidth <= 0) return undefined;
  return Math.round((targetWidth / baseWidth) * 100) / 100;
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
// Node Finding
// =============================================================================

/**
 * Find a node by key name (first match)
 */
function findNode(
  prompt: ComfyNodeGraph,
  keys: readonly string[],
): ComfyNode | undefined {
  return Object.entries(prompt).find(([key]) => keys.includes(key))?.[1];
}

// =============================================================================
// Text Extraction
// =============================================================================

/**
 * Extract text from CLIP text encode node
 */
function extractText(node: ComfyNode | undefined): string {
  return typeof node?.inputs.text === 'string' ? node.inputs.text : '';
}

/**
 * Extract prompt texts from CLIP nodes
 */
function extractPromptTexts(prompt: ComfyNodeGraph): {
  promptText: string;
  negativeText: string;
} {
  const positiveClip = findNode(prompt, COMFYUI_NODE_KEYS.positiveClip);
  const negativeClip = findNode(prompt, COMFYUI_NODE_KEYS.negativeClip);
  return {
    promptText: extractText(positiveClip),
    negativeText: extractText(negativeClip),
  };
}

/**
 * Extract dimensions from LatentImage node
 */
function extractDimensions(prompt: ComfyNodeGraph): {
  width: number;
  height: number;
} {
  const latentImage = findNode(prompt, COMFYUI_NODE_KEYS.latentImage);
  return {
    width: latentImage ? Number(latentImage.inputs.width) || 0 : 0,
    height: latentImage ? Number(latentImage.inputs.height) || 0 : 0,
  };
}

/**
 * Extract sampling settings from KSampler node
 */
function extractSamplingFromKSampler(
  ksampler: ComfyNode | undefined,
): SamplingSettings | undefined {
  if (!ksampler) return undefined;
  return {
    seed: ksampler.inputs.seed as number,
    steps: ksampler.inputs.steps as number,
    cfg: ksampler.inputs.cfg as number,
    sampler: ksampler.inputs.sampler_name as string,
    scheduler: ksampler.inputs.scheduler as string,
  };
}

/**
 * Extract model name from Checkpoint node
 */
function extractModelFromCheckpoint(
  checkpoint: ComfyNode | undefined,
): ModelSettings | undefined {
  if (!checkpoint?.inputs?.ckpt_name) return undefined;
  return { name: String(checkpoint.inputs.ckpt_name) };
}

// =============================================================================
// ComfyUI Metadata Extraction
// =============================================================================

/**
 * Extract metadata from ComfyUI nodes
 *
 * Extracts prompt, dimensions, model, sampling, and hires settings
 * from standard ComfyUI node structure.
 *
 * @param prompt - Parsed ComfyUI prompt (node graph)
 * @returns Partial metadata from ComfyUI nodes
 */
function extractComfyUIMetadata(
  prompt: ComfyNodeGraph,
): PartialMetadata | undefined {
  // Extract from specialized nodes
  const { promptText, negativeText } = extractPromptTexts(prompt);
  const { width, height } = extractDimensions(prompt);
  const ksampler = findNode(prompt, COMFYUI_NODE_KEYS.sampler);
  const checkpoint = findNode(prompt, COMFYUI_NODE_KEYS.checkpoint);

  // Extract hires/upscale settings
  const hiresModel = findNode(
    prompt,
    COMFYUI_NODE_KEYS.hiresModelUpscale,
  )?.inputs;
  const hiresScale = findNode(
    prompt,
    COMFYUI_NODE_KEYS.hiresImageScale,
  )?.inputs;
  const hiresSampler = findNode(prompt, COMFYUI_NODE_KEYS.hiresSampler)?.inputs;

  return trimObject({
    prompt: promptText || undefined,
    negativePrompt: negativeText || undefined,
    width: width > 0 ? width : undefined,
    height: height > 0 ? height : undefined,
    model: extractModelFromCheckpoint(checkpoint),
    sampling: extractSamplingFromKSampler(ksampler),
    ...buildHiresOrUpscale(hiresModel, hiresScale, hiresSampler, width),
  });
}

/**
 * Build hires or upscale settings from ComfyUI nodes
 *
 * @param hiresModel - Upscale model loader node inputs
 * @param hiresScale - Image scale node inputs
 * @param hiresSampler - Hires sampler node inputs (optional)
 * @param baseWidth - Base image width for scale calculation
 * @returns Hires or upscale settings
 */
function buildHiresOrUpscale(
  hiresModel: Record<string, unknown> | undefined,
  hiresScale: Record<string, unknown> | undefined,
  hiresSampler: Record<string, unknown> | undefined,
  baseWidth: number,
): Pick<PartialMetadata, 'hires' | 'upscale'> {
  if (!hiresModel || !hiresScale) return {};

  const hiresWidth = hiresScale.width as number;
  const scale = calculateScale(hiresWidth, baseWidth);

  if (hiresSampler) {
    return {
      hires: {
        upscaler: hiresModel.model_name as string,
        scale,
        steps: hiresSampler.steps as number,
        denoise: hiresSampler.denoise as number,
      },
    };
  }

  return {
    upscale: {
      upscaler: hiresModel.model_name as string,
      scale,
    },
  };
}

// =============================================================================
// Civitai Extra Metadata
// =============================================================================

/**
 * Extract extraMetadata from ComfyUI prompt or entryRecord
 *
 * Civitai upscale workflows embed original generation params in extraMetadata field.
 * This can be:
 * 1. Inside the prompt JSON (JPEG format: single JSON with all data)
 * 2. As a separate entry (PNG format: extraMetadata as separate chunk)
 */
function extractExtraMetadata(
  prompt: ComfyNodeGraph,
  entryRecord?: EntryRecord,
): CivitaiExtraMetadata | undefined {
  // First try to find extraMetadata inside the prompt (JPEG format)
  const extraMetaField = (prompt as Record<string, unknown>).extraMetadata;
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

// =============================================================================
// CivitAI Metadata Extraction
// =============================================================================

/**
 * Extract metadata from CivitAI extraMetadata (fallback source)
 *
 * Used when ComfyUI nodes don't contain the expected data
 * (e.g., upscale-only workflows from Civitai).
 *
 * @param extraMeta - CivitAI extraMetadata
 * @returns Partial metadata from CivitAI extraMetadata
 */
function extractCivitaiMetadata(
  extraMeta: CivitaiExtraMetadata | undefined,
): PartialMetadata | undefined {
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

/**
 * Build upscale settings from CivitAI transformations
 *
 * CivitAI stores upscale information in extraMetadata.transformations array.
 * This extracts the upscale transformation and calculates the scale factor.
 *
 * @param extraMeta - CivitAI extraMetadata
 * @returns Upscale settings if transformation exists
 */
function buildCivitaiUpscale(
  extraMeta: CivitaiExtraMetadata,
): Pick<PartialMetadata, 'upscale'> {
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
 *
 * @param extraMeta - CivitAI extraMetadata
 * @returns Sampling settings if any field exists
 */
function buildCivitaiSampling(
  extraMeta: CivitaiExtraMetadata,
): Pick<PartialMetadata, 'sampling'> {
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

// =============================================================================
// Metadata Merging
// =============================================================================

/**
 * Merge two partial metadata objects
 *
 * ComfyUI metadata takes priority over CivitAI fallback.
 * Handles:
 * - Required fields: defaults to empty/zero if both undefined
 * - Optional fields: omitted if undefined (not set to undefined)
 *
 * @param base - Base metadata (lower priority, e.g., CivitAI fallback)
 * @param override - Override metadata (higher priority, e.g., ComfyUI nodes)
 * @returns Merged metadata with required fields and optional fields
 */
function mergeMetadata(
  base: PartialMetadata | undefined,
  override: PartialMetadata | undefined,
): MergedMetadata {
  // Override takes priority (ComfyUI values win if present)
  const merged = { ...base, ...override };

  return {
    // Required fields with defaults
    prompt: merged.prompt ?? '',
    negativePrompt: merged.negativePrompt ?? '',
    width: merged.width ?? 0,
    height: merged.height ?? 0,
    // Optional fields - only include if defined
    ...trimObject({
      model: merged.model,
      sampling: merged.sampling,
      hires: merged.hires,
      upscale: merged.upscale,
    }),
  };
}
