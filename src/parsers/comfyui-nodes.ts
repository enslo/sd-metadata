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
// Constants
// =============================================================================

/**
 * ComfyUI node class types for metadata extraction
 *
 * These class_type values identify specific node types in the ComfyUI node graph.
 * Arrays allow matching multiple node type variants.
 */
export const CLASS_TYPES = {
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

// =============================================================================
// Node Finding
// =============================================================================

/**
 * Find a node by class_type (first match)
 */
export function findNode(
  nodes: ComfyNodeGraph,
  classTypes: readonly string[],
): ComfyNode | undefined {
  return Object.values(nodes).find((node) =>
    classTypes.includes(node.class_type),
  );
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
 * Extract prompt texts by tracing from sampler's positive/negative inputs
 */
export function extractPromptTexts(nodes: ComfyNodeGraph): {
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

// =============================================================================
// Dimension Extraction
// =============================================================================

/**
 * Extract dimensions from LatentImage node
 *
 * Handles two node types separately:
 * - EmptyLatentImage: inputs.width and inputs.height as numbers
 * - SDXL Empty Latent Image (rgthree): inputs.dimensions as string like "1024 x 1024 (square)"
 */
export function extractDimensions(nodes: ComfyNodeGraph): {
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

// =============================================================================
// Sampling & Model Extraction
// =============================================================================

/**
 * Extract sampling settings from sampler node
 */
export function extractSampling(
  nodes: ComfyNodeGraph,
): SamplingSettings | undefined {
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
export function extractModel(nodes: ComfyNodeGraph): ModelSettings | undefined {
  const checkpoint = findNode(nodes, CLASS_TYPES.checkpoint);
  if (!checkpoint?.inputs?.ckpt_name) return undefined;
  return { name: String(checkpoint.inputs.ckpt_name) };
}

// =============================================================================
// Hires Detection
// =============================================================================

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
export function isHiresSampler(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode,
): boolean {
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
export function findHiresSampler(nodes: ComfyNodeGraph): ComfyNode | undefined {
  const samplerTypes: readonly string[] = CLASS_TYPES.sampler;
  return Object.values(nodes).find(
    (node) =>
      samplerTypes.includes(node.class_type) && isHiresSampler(nodes, node),
  );
}
