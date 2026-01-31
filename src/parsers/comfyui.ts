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
 * ComfyUI node class types for metadata extraction
 *
 * These class_type values identify specific node types in the ComfyUI node graph.
 * Arrays allow matching multiple node type variants.
 */
const CLASS_TYPES = {
  sampler: ['KSampler', 'KSamplerAdvanced', 'SamplerCustomAdvanced'],
  // Standard latent image nodes with width/height properties
  latentImage: ['EmptyLatentImage'],
  // rgthree latent image nodes with "dimensions" string property
  latentImageRgthree: ['SDXL Empty Latent Image (rgthree)'],
  checkpoint: ['CheckpointLoaderSimple', 'CheckpointLoader'],
  hiresModelUpscale: ['UpscaleModelLoader'],
  hiresImageScale: ['ImageScale', 'ImageScaleBy'],
  latentUpscale: ['LatentUpscale', 'LatentUpscaleBy'],
  vaeEncode: ['VAEEncode', 'VAEEncodeTiled'],
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
 * Find a node by class_type (first match)
 */
function findNode(
  nodes: ComfyNodeGraph,
  classTypes: readonly string[],
): ComfyNode | undefined {
  return Object.values(nodes).find((node) =>
    classTypes.includes(node.class_type),
  );
}

// =============================================================================
// Node Reference Utilities
// =============================================================================

/**
 * Check if a value is a node reference [nodeId, outputIndex]
 */
function isNodeReference(value: unknown): value is [string, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    (typeof value[0] === 'string' || typeof value[0] === 'number') &&
    typeof value[1] === 'number'
  );
}

/**
 * Extract text from a node, following references if needed
 *
 * Handles various text input patterns:
 * - CLIPTextEncode: inputs.text
 * - Power Prompt (rgthree): inputs.prompt
 * - DF_Text_Box (ComfyRoll): inputs.Text
 * - Reference chains: [nodeId, outputIndex] -> trace to source
 */
function extractText(
  nodes: ComfyNodeGraph,
  nodeId: string,
  maxDepth = 10,
): string {
  if (maxDepth <= 0) return '';

  const node = nodes[nodeId];
  if (!node) return '';

  // Try common text input names
  const textValue = node.inputs.text ?? node.inputs.prompt ?? node.inputs.Text;

  if (typeof textValue === 'string') {
    return textValue;
  }

  // If text is a reference, follow it
  if (isNodeReference(textValue)) {
    return extractText(nodes, String(textValue[0]), maxDepth - 1);
  }

  return '';
}

// =============================================================================
// Text Extraction
// =============================================================================

/**
 * Extract prompt texts by tracing from sampler's positive/negative inputs
 */
function extractPromptTexts(nodes: ComfyNodeGraph): {
  promptText: string;
  negativeText: string;
} {
  // Find sampler node by class_type
  const sampler = findNode(nodes, CLASS_TYPES.sampler);
  if (!sampler) {
    return { promptText: '', negativeText: '' };
  }

  // Trace positive/negative inputs from sampler
  const positiveRef = sampler.inputs.positive;
  const negativeRef = sampler.inputs.negative;

  return {
    promptText: isNodeReference(positiveRef)
      ? extractText(nodes, String(positiveRef[0]))
      : '',
    negativeText: isNodeReference(negativeRef)
      ? extractText(nodes, String(negativeRef[0]))
      : '',
  };
}

/**
 * Extract dimensions from LatentImage node
 *
 * Handles two node types separately:
 * - EmptyLatentImage: inputs.width and inputs.height as numbers
 * - SDXL Empty Latent Image (rgthree): inputs.dimensions as string like "1024 x 1024 (square)"
 */
function extractDimensions(nodes: ComfyNodeGraph): {
  width: number;
  height: number;
} {
  // Try standard EmptyLatentImage first (width/height properties)
  const standardLatent = findNode(nodes, CLASS_TYPES.latentImage);
  if (standardLatent) {
    const width = Number(standardLatent.inputs.width) || 0;
    const height = Number(standardLatent.inputs.height) || 0;
    if (width > 0 && height > 0) return { width, height };
  }

  // Try rgthree latent image (dimensions string like "1024 x 1024 (square)")
  const rgthreeLatent = findNode(nodes, CLASS_TYPES.latentImageRgthree);
  if (rgthreeLatent && typeof rgthreeLatent.inputs.dimensions === 'string') {
    const match = rgthreeLatent.inputs.dimensions.match(/^(\d+)\s*x\s*(\d+)/);
    if (match?.[1] && match[2]) {
      return {
        width: Number.parseInt(match[1], 10),
        height: Number.parseInt(match[2], 10),
      };
    }
  }

  return { width: 0, height: 0 };
}

/**
 * Extract sampling settings from sampler node
 */
function extractSampling(nodes: ComfyNodeGraph): SamplingSettings | undefined {
  const sampler = findNode(nodes, CLASS_TYPES.sampler);
  if (!sampler) return undefined;

  // Handle seed which may be a reference or direct value
  let seed = sampler.inputs.seed;
  if (isNodeReference(seed)) {
    // Seed is from another node (e.g., CR Seed), try to extract it
    const seedNode = nodes[String(seed[0])];
    seed = seedNode?.inputs.seed;
  }

  return {
    seed: seed as number,
    steps: sampler.inputs.steps as number,
    cfg: sampler.inputs.cfg as number,
    sampler: sampler.inputs.sampler_name as string,
    scheduler: sampler.inputs.scheduler as string,
  };
}

/**
 * Extract model name from Checkpoint node
 */
function extractModel(nodes: ComfyNodeGraph): ModelSettings | undefined {
  const checkpoint = findNode(nodes, CLASS_TYPES.checkpoint);
  if (!checkpoint?.inputs?.ckpt_name) return undefined;
  return { name: String(checkpoint.inputs.ckpt_name) };
}

/**
 * Check if a sampler is a hires sampler by tracing its latent_image input
 *
 * Hires fix workflows have two patterns:
 * 1. Image space: KSampler.latent_image → VAE Encode → Upscale Image
 * 2. Latent space: KSampler.latent_image → LatentUpscale
 *
 * @param nodes - ComfyUI node graph
 * @param sampler - Sampler node to check
 * @returns true if this sampler is connected to an upscaled pipeline
 */
function isHiresSampler(nodes: ComfyNodeGraph, sampler: ComfyNode): boolean {
  const latentImageRef = sampler.inputs.latent_image;
  if (!isNodeReference(latentImageRef)) return false;

  const inputNode = nodes[String(latentImageRef[0])];
  if (!inputNode) return false;

  // Pattern 1: Latent space upscale (LatentUpscale → KSampler)
  const latentUpscaleTypes: readonly string[] = CLASS_TYPES.latentUpscale;
  if (latentUpscaleTypes.includes(inputNode.class_type)) {
    return true;
  }

  // Pattern 2: Image space upscale (ImageScale → VAEEncode → KSampler)
  const vaeTypes: readonly string[] = CLASS_TYPES.vaeEncode;
  if (!vaeTypes.includes(inputNode.class_type)) return false;

  const pixelsRef = inputNode.inputs.pixels;
  if (!isNodeReference(pixelsRef)) return false;

  const upscaleNode = nodes[String(pixelsRef[0])];
  if (!upscaleNode) return false;

  const imageScaleTypes: readonly string[] = CLASS_TYPES.hiresImageScale;
  return imageScaleTypes.includes(upscaleNode.class_type);
}

/**
 * Find hires sampler node by connection pattern
 *
 * Detects hires fix by tracing: KSampler.latent_image → VAE Encode → Upscale Image
 * This is more reliable than checking denoise < 1, which can be used in normal generation.
 */
function findHiresSampler(nodes: ComfyNodeGraph): ComfyNode | undefined {
  const samplerTypes: readonly string[] = CLASS_TYPES.sampler;
  return Object.values(nodes).find(
    (node) =>
      samplerTypes.includes(node.class_type) && isHiresSampler(nodes, node),
  );
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
  // Extract from nodes using class_type lookup
  const { promptText, negativeText } = extractPromptTexts(nodes);
  const { width, height } = extractDimensions(nodes);

  // Extract hires/upscale settings
  const hiresModel = findNode(nodes, CLASS_TYPES.hiresModelUpscale)?.inputs;
  // Try image scale first, then latent upscale
  const hiresImageScale = findNode(nodes, CLASS_TYPES.hiresImageScale)?.inputs;
  const latentUpscale = findNode(nodes, CLASS_TYPES.latentUpscale)?.inputs;
  const hiresSampler = findHiresSampler(nodes)?.inputs;

  return trimObject({
    prompt: promptText || undefined,
    negativePrompt: negativeText || undefined,
    width: width > 0 ? width : undefined,
    height: height > 0 ? height : undefined,
    model: extractModel(nodes),
    sampling: extractSampling(nodes),
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
 * Deep merge two objects, excluding undefined values
 *
 * Unlike spread operator, this does NOT let undefined values override defined ones.
 * Example: mergeObjects({ scale: 1.5 }, { upscaler: 'x', scale: undefined })
 *          = { scale: 1.5, upscaler: 'x' }
 *
 * @param base - Base object (lower priority)
 * @param override - Override object (higher priority for defined values)
 * @returns Merged object or undefined if empty
 */
function mergeObjects<T extends object>(
  base: T | undefined,
  override: T | undefined,
): T | undefined {
  if (!base && !override) return undefined;

  const merged: Record<string, unknown> = {};

  // Add base properties (excluding undefined)
  if (base) {
    for (const [key, value] of Object.entries(base)) {
      if (value !== undefined) merged[key] = value;
    }
  }

  // Add override properties (excluding undefined, these win over base)
  if (override) {
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) merged[key] = value;
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
