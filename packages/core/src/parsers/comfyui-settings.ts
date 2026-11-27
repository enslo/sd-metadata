/**
 * ComfyUI generation settings extraction
 *
 * Reads the image size, the sampling settings, the model and the clip skip
 * from nodes picked out of the graph by role (see comfyui-graph).
 */

import type {
  ComfyNode,
  ComfyNodeGraph,
  ModelSettings,
  SamplingSettings,
} from '../types';
import { toSeedString } from '../utils/seed';
import {
  isNodeReference,
  resolveLiteralInput,
  resolveNode,
  resolveNumberInput,
  resolveStringInput,
} from './comfyui-graph';

// =============================================================================
// Dimension Extraction
// =============================================================================

/**
 * Read "W x H" from a dimensions string
 *
 * Custom-size sentinels ("width x height (custom)", "自定义 x 自定义") do not
 * match and yield undefined.
 */
function parseDimensionsString(
  value: unknown,
): { width: number; height: number } | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^(\d+)\s*x\s*(\d+)/);
  if (!match?.[1] || !match[2]) return undefined;
  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

/**
 * Extract dimensions from pre-classified LatentImage nodes
 *
 * Handles three node types separately:
 * - EmptyLatentImage: inputs.width and inputs.height as numbers
 * - SDXL Empty Latent Image (rgthree): inputs.dimensions as string like "1024 x 1024 (square)"
 * - All-in-one loaders: inputs.resolution as "1024 x 1024" (Easy-Use,
 *   unless set to a custom-size sentinel), else inputs.empty_latent_width
 *   and inputs.empty_latent_height
 *
 * @param latentImage - Standard EmptyLatentImage node
 * @param latentImageRgthree - rgthree SDXL latent image node
 * @param allInOneLoader - Efficient Loader / easy fullLoader node
 */
export function extractDimensions(
  latentImage: ComfyNode | undefined,
  latentImageRgthree: ComfyNode | undefined,
  allInOneLoader?: ComfyNode,
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
  const rgthree = parseDimensionsString(latentImageRgthree?.inputs.dimensions);
  if (rgthree) return rgthree;

  // Try an all-in-one loader: the resolution preset wins over the width and
  // height inputs, which only apply to the custom-size sentinel
  if (allInOneLoader) {
    const preset = parseDimensionsString(allInOneLoader.inputs.resolution);
    if (preset) return preset;
    const width = Number(allInOneLoader.inputs.empty_latent_width) || 0;
    const height = Number(allInOneLoader.inputs.empty_latent_height) || 0;
    if (width > 0 && height > 0) return { width, height };
  }

  return { width: 0, height: 0 };
}

// =============================================================================
// Sampling Extraction
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

  if (sampler.class_type === 'SamplerCustom') {
    return extractCustomSampling(nodes, sampler);
  }

  // KSamplerAdvanced and KSampler Adv. (Efficient) name the seed noise_seed
  const seed = resolveSeedInput(
    nodes,
    sampler.inputs.seed ?? sampler.inputs.noise_seed,
  );

  return {
    seed,
    steps: resolveNumberInput(nodes, sampler.inputs.steps),
    cfg: resolveNumberInput(nodes, sampler.inputs.cfg),
    sampler: resolveStringInput(nodes, sampler.inputs.sampler_name),
    scheduler: resolveStringInput(nodes, sampler.inputs.scheduler),
    denoise: resolveNumberInput(nodes, sampler.inputs.denoise),
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

  return {
    seed: resolveSeedInput(nodes, noiseNode?.inputs.noise_seed),
    steps: resolveNumberInput(nodes, schedulerNode?.inputs.steps),
    cfg: resolveNumberInput(nodes, guiderNode?.inputs.cfg),
    sampler: resolveStringInput(nodes, samplerSelectNode?.inputs.sampler_name),
    scheduler: resolveStringInput(nodes, schedulerNode?.inputs.scheduler),
    denoise: resolveNumberInput(nodes, schedulerNode?.inputs.denoise),
  };
}

/**
 * Resolve a seed input to its string form
 *
 * A seed is a literal, a reference to a primitive node (PrimitiveInt)
 * holding it in `value`, or a reference to a seed node (CR Seed) holding
 * it in its own `seed` input.
 */
function resolveSeedInput(
  nodes: ComfyNodeGraph,
  value: unknown,
): string | undefined {
  const literal = resolveLiteralInput(nodes, value);
  return (
    toSeedString(literal) ??
    toSeedString(resolveNode(nodes, value)?.inputs.seed)
  );
}

/**
 * Extract sampling settings from SamplerCustom
 *
 * Similar to SamplerCustomAdvanced but cfg and noise_seed are located
 * differently:
 * - cfg: directly on the sampler node (not via guider)
 * - noise_seed: reference to a seed node (not via noise node)
 * - sampler → KSamplerSelect → sampler_name
 * - sigmas → BasicScheduler → scheduler, steps, denoise
 */
function extractCustomSampling(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode,
): SamplingSettings {
  const samplerSelectNode = resolveNode(nodes, sampler.inputs.sampler);
  const schedulerNode = resolveNode(nodes, sampler.inputs.sigmas);

  // noise_seed may be a direct value or a reference to a seed node
  let seed = sampler.inputs.noise_seed;
  if (isNodeReference(seed)) {
    const seedNode = nodes[String(seed[0])];
    seed = seedNode?.inputs.seed;
  }

  return {
    seed: toSeedString(seed),
    steps: resolveNumberInput(nodes, schedulerNode?.inputs.steps),
    cfg: resolveNumberInput(nodes, sampler.inputs.cfg),
    sampler: resolveStringInput(nodes, samplerSelectNode?.inputs.sampler_name),
    scheduler: resolveStringInput(nodes, schedulerNode?.inputs.scheduler),
    denoise: resolveNumberInput(nodes, schedulerNode?.inputs.denoise),
  };
}

// =============================================================================
// Model Extraction
// =============================================================================

/**
 * Extract model name from pre-classified model loader node
 *
 * Checks CheckpointLoader first, then falls back to UNETLoader.
 * Only string literal values are accepted — node references like
 * ["928", 0] (forwarded checkpoint connections) are ignored so the
 * caller's flat-scan fallback can locate the real model name elsewhere.
 *
 * @param checkpoint - Pre-classified checkpoint loader node
 * @param unetLoader - Pre-classified UNET loader node (fallback)
 */
export function extractModel(
  checkpoint: ComfyNode | undefined,
  unetLoader?: ComfyNode | undefined,
): ModelSettings | undefined {
  const ckptName = checkpoint?.inputs?.ckpt_name;
  if (typeof ckptName === 'string' && ckptName) {
    return { name: ckptName };
  }
  const unetName = unetLoader?.inputs?.unet_name;
  if (typeof unetName === 'string' && unetName) {
    return { name: unetName };
  }
  return undefined;
}

/**
 * Extract CLIP skip value from CLIPSetLastLayer node
 *
 * stop_at_clip_layer is negative (-2 = clip skip 2). All-in-one loaders
 * carry the same value as `clip_skip` and are the fallback.
 * Returns undefined if no node is present.
 *
 * @param clipSetLastLayer - Pre-classified CLIPSetLastLayer node
 * @param allInOneLoader - Efficient Loader / easy fullLoader node
 */
export function extractClipSkip(
  clipSetLastLayer: ComfyNode | undefined,
  allInOneLoader?: ComfyNode,
): number | undefined {
  const stopAt =
    clipSetLastLayer?.inputs.stop_at_clip_layer ??
    allInOneLoader?.inputs.clip_skip;
  if (typeof stopAt !== 'number') return undefined;
  return -stopAt;
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
