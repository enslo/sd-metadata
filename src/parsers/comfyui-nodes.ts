/**
 * ComfyUI node graph utilities
 *
 * Functions for searching and extracting data from ComfyUI node graphs.
 * Node graphs use class_type to identify node types and [nodeId, outputIndex]
 * arrays to reference connections between nodes.
 */

import type {
  ComfyNode,
  ComfyNodeGraph,
  ModelSettings,
  SamplingSettings,
} from '../types';

// =============================================================================
// Node Class Type Constants
// =============================================================================

const SAMPLER_TYPES = ['KSampler', 'KSamplerAdvanced', 'SamplerCustomAdvanced'];
const LATENT_IMAGE_TYPES = ['EmptyLatentImage'];
const LATENT_IMAGE_RGTHREE_TYPES = ['SDXL Empty Latent Image (rgthree)'];
const CHECKPOINT_TYPES = ['CheckpointLoaderSimple', 'CheckpointLoader'];
const UNET_LOADER_TYPES = ['UNETLoader'];
const HIRES_MODEL_UPSCALE_TYPES = ['UpscaleModelLoader'];
const HIRES_IMAGE_SCALE_TYPES = ['ImageScale', 'ImageScaleBy'];
const LATENT_UPSCALE_TYPES = ['LatentUpscale', 'LatentUpscaleBy'];
const VAE_ENCODE_TYPES = ['VAEEncode', 'VAEEncodeTiled'];

// =============================================================================
// Node Classification (Single-Pass)
// =============================================================================

/**
 * Pre-classified ComfyUI nodes by role
 *
 * Built by a single pass over the node graph.
 */
export interface ClassifiedNodes {
  sampler?: ComfyNode;
  latentImage?: ComfyNode;
  latentImageRgthree?: ComfyNode;
  checkpoint?: ComfyNode;
  unetLoader?: ComfyNode;
  hiresModelUpscale?: ComfyNode;
  hiresImageScale?: ComfyNode;
  latentUpscale?: ComfyNode;
  vaeEncode?: ComfyNode;
}

/**
 * Classify all nodes in a single pass over the node graph
 *
 * Replaces multiple findNode() calls with one iteration.
 * Stores the first matching node for each category.
 */
export function classifyNodes(nodes: ComfyNodeGraph): ClassifiedNodes {
  const result: ClassifiedNodes = {};

  for (const node of Object.values(nodes)) {
    const ct = node.class_type;

    if (!result.sampler && SAMPLER_TYPES.includes(ct)) {
      result.sampler = node;
    } else if (!result.latentImage && LATENT_IMAGE_TYPES.includes(ct)) {
      result.latentImage = node;
    } else if (
      !result.latentImageRgthree &&
      LATENT_IMAGE_RGTHREE_TYPES.includes(ct)
    ) {
      result.latentImageRgthree = node;
    } else if (!result.checkpoint && CHECKPOINT_TYPES.includes(ct)) {
      result.checkpoint = node;
    } else if (!result.unetLoader && UNET_LOADER_TYPES.includes(ct)) {
      result.unetLoader = node;
    } else if (
      !result.hiresModelUpscale &&
      HIRES_MODEL_UPSCALE_TYPES.includes(ct)
    ) {
      result.hiresModelUpscale = node;
    } else if (
      !result.hiresImageScale &&
      HIRES_IMAGE_SCALE_TYPES.includes(ct)
    ) {
      result.hiresImageScale = node;
    } else if (!result.latentUpscale && LATENT_UPSCALE_TYPES.includes(ct)) {
      result.latentUpscale = node;
    } else if (!result.vaeEncode && VAE_ENCODE_TYPES.includes(ct)) {
      result.vaeEncode = node;
    }
  }

  return result;
}

// =============================================================================
// Node Reference Utilities
// =============================================================================

/**
 * Resolve a node reference to the target node
 */
function resolveNode(
  nodes: ComfyNodeGraph,
  ref: unknown,
): ComfyNode | undefined {
  if (!isNodeReference(ref)) return undefined;
  return nodes[String(ref[0])];
}

/**
 * Check if a value is a node reference [nodeId, outputIndex]
 */
export function isNodeReference(value: unknown): value is [string, number] {
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
export function extractText(
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
// Prompt Extraction
// =============================================================================

/**
 * Resolve the node that holds positive/negative conditioning references
 *
 * KSampler/KSamplerAdvanced have positive/negative directly.
 * SamplerCustomAdvanced routes through a guider node (e.g. CFGGuider).
 */
function resolveConditioningSource(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode,
): ComfyNode {
  const guiderNode = resolveNode(nodes, sampler.inputs.guider);
  if (guiderNode) return guiderNode;
  return sampler;
}

/**
 * Extract prompt texts by tracing from sampler's positive/negative inputs
 *
 * @param nodes - Full node graph (needed for reference following)
 * @param sampler - Pre-classified sampler node
 */
export function extractPromptTexts(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode | undefined,
): {
  promptText: string;
  negativeText: string;
} {
  if (!sampler) {
    return { promptText: '', negativeText: '' };
  }

  // Resolve the node that holds positive/negative conditioning references.
  // KSampler/KSamplerAdvanced: directly on sampler inputs
  // SamplerCustomAdvanced: on the CFGGuider node via guider input
  const conditioningSource = resolveConditioningSource(nodes, sampler);

  const positiveRef = conditioningSource.inputs.positive;
  const negativeRef = conditioningSource.inputs.negative;

  return {
    promptText: isNodeReference(positiveRef)
      ? extractText(nodes, String(positiveRef[0]))
      : '',
    negativeText: isNodeReference(negativeRef)
      ? extractText(nodes, String(negativeRef[0]))
      : '',
  };
}

// =============================================================================
// Dimension Extraction
// =============================================================================

/**
 * Extract dimensions from pre-classified LatentImage nodes
 *
 * Handles two node types separately:
 * - EmptyLatentImage: inputs.width and inputs.height as numbers
 * - SDXL Empty Latent Image (rgthree): inputs.dimensions as string like "1024 x 1024 (square)"
 *
 * @param latentImage - Standard EmptyLatentImage node
 * @param latentImageRgthree - rgthree SDXL latent image node
 */
export function extractDimensions(
  latentImage: ComfyNode | undefined,
  latentImageRgthree: ComfyNode | undefined,
): {
  width: number;
  height: number;
} {
  // Try standard EmptyLatentImage first (width/height properties)
  if (latentImage) {
    const width = Number(latentImage.inputs.width) || 0;
    const height = Number(latentImage.inputs.height) || 0;
    if (width > 0 && height > 0) return { width, height };
  }

  // Try rgthree latent image (dimensions string like "1024 x 1024 (square)")
  if (
    latentImageRgthree &&
    typeof latentImageRgthree.inputs.dimensions === 'string'
  ) {
    const match =
      latentImageRgthree.inputs.dimensions.match(/^(\d+)\s*x\s*(\d+)/);
    if (match?.[1] && match[2]) {
      return {
        width: Number.parseInt(match[1], 10),
        height: Number.parseInt(match[2], 10),
      };
    }
  }

  return { width: 0, height: 0 };
}

// =============================================================================
// Sampling & Model Extraction
// =============================================================================

/**
 * Extract sampling settings from pre-classified sampler node
 *
 * @param nodes - Full node graph (needed for seed reference following)
 * @param sampler - Pre-classified sampler node
 */
export function extractSampling(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode | undefined,
): SamplingSettings | undefined {
  if (!sampler) return undefined;

  if (sampler.class_type === 'SamplerCustomAdvanced') {
    return extractAdvancedSampling(nodes, sampler);
  }

  // Handle seed which may be a reference or direct value
  let seed = sampler.inputs.seed;
  if (isNodeReference(seed)) {
    // Seed is from another node (e.g., CR Seed), try to extract it
    const seedNode = nodes[String(seed[0])];
    seed = seedNode?.inputs.seed;
  }

  // Extract denoise only if explicitly set and less than 1.0
  // (denoise = 1.0 is the txt2img default, not meaningful to store)
  const rawDenoise = sampler.inputs.denoise;
  const denoise =
    typeof rawDenoise === 'number' && rawDenoise < 1 ? rawDenoise : undefined;

  return {
    seed: seed as number,
    steps: sampler.inputs.steps as number,
    cfg: sampler.inputs.cfg as number,
    sampler: sampler.inputs.sampler_name as string,
    scheduler: sampler.inputs.scheduler as string,
    denoise,
  };
}

/**
 * Extract sampling settings from SamplerCustomAdvanced
 *
 * Traces distributed inputs:
 * - noise → RandomNoise → noise_seed
 * - guider → CFGGuider → cfg
 * - sampler → KSamplerSelect → sampler_name
 * - sigmas → BasicScheduler → scheduler, steps, denoise
 */
function extractAdvancedSampling(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode,
): SamplingSettings {
  const noiseNode = resolveNode(nodes, sampler.inputs.noise);
  const guiderNode = resolveNode(nodes, sampler.inputs.guider);
  const samplerSelectNode = resolveNode(nodes, sampler.inputs.sampler);
  const schedulerNode = resolveNode(nodes, sampler.inputs.sigmas);

  const rawDenoise = schedulerNode?.inputs.denoise;
  const denoise =
    typeof rawDenoise === 'number' && rawDenoise < 1 ? rawDenoise : undefined;

  return {
    seed: noiseNode?.inputs.noise_seed as number,
    steps: schedulerNode?.inputs.steps as number,
    cfg: guiderNode?.inputs.cfg as number,
    sampler: samplerSelectNode?.inputs.sampler_name as string,
    scheduler: schedulerNode?.inputs.scheduler as string,
    denoise,
  };
}

/**
 * Extract model name from pre-classified model loader node
 *
 * Checks CheckpointLoader first, then falls back to UNETLoader.
 *
 * @param checkpoint - Pre-classified checkpoint loader node
 * @param unetLoader - Pre-classified UNET loader node (fallback)
 */
export function extractModel(
  checkpoint: ComfyNode | undefined,
  unetLoader?: ComfyNode | undefined,
): ModelSettings | undefined {
  if (checkpoint?.inputs?.ckpt_name) {
    return { name: String(checkpoint.inputs.ckpt_name) };
  }
  if (unetLoader?.inputs?.unet_name) {
    return { name: String(unetLoader.inputs.unet_name) };
  }
  return undefined;
}

// =============================================================================
// Scale Calculation
// =============================================================================

/**
 * Calculate scale factor rounded to 2 decimal places
 *
 * @param targetWidth - Target width after scaling
 * @param baseWidth - Original base width
 * @returns Scale factor or undefined if invalid inputs
 */
export function calculateScale(
  targetWidth: number,
  baseWidth: number,
): number | undefined {
  if (baseWidth <= 0 || targetWidth <= 0) return undefined;
  return Math.round((targetWidth / baseWidth) * 100) / 100;
}

// =============================================================================
// Hires Detection
// =============================================================================

/**
 * Check if a sampler is a hires sampler by tracing its latent_image input
 *
 * Hires fix workflows have two patterns:
 * 1. Image space: KSampler.latent_image -> VAE Encode -> Upscale Image
 * 2. Latent space: KSampler.latent_image -> LatentUpscale
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

  // Pattern 1: Latent space upscale (LatentUpscale -> KSampler)
  if (LATENT_UPSCALE_TYPES.includes(inputNode.class_type)) {
    return true;
  }

  // Pattern 2: Image space upscale (ImageScale -> VAEEncode -> KSampler)
  if (!VAE_ENCODE_TYPES.includes(inputNode.class_type)) return false;

  const pixelsRef = inputNode.inputs.pixels;
  if (!isNodeReference(pixelsRef)) return false;

  const upscaleNode = nodes[String(pixelsRef[0])];
  if (!upscaleNode) return false;

  return HIRES_IMAGE_SCALE_TYPES.includes(upscaleNode.class_type);
}

/**
 * Find hires sampler node by connection pattern
 *
 * Detects hires fix by tracing: KSampler.latent_image -> VAE Encode -> Upscale Image
 * This is more reliable than checking denoise < 1, which can be used in normal generation.
 */
export function findHiresSampler(nodes: ComfyNodeGraph): ComfyNode | undefined {
  return Object.values(nodes).find(
    (node) =>
      SAMPLER_TYPES.includes(node.class_type) && isHiresSampler(nodes, node),
  );
}
