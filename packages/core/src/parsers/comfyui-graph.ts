/**
 * ComfyUI node graph utilities
 *
 * Node graphs use class_type to identify node types and [nodeId, outputIndex]
 * arrays to reference connections between nodes. This module finds nodes by
 * role, resolves references to the literals they carry and tells which
 * nodes a node depends on.
 */

import type { ComfyNode, ComfyNodeGraph } from '../types';

// =============================================================================
// Node Class Type Constants
// =============================================================================

const SAMPLER_TYPES = [
  'KSampler',
  'KSamplerAdvanced',
  'SamplerCustomAdvanced',
  'SamplerCustom',
  'DetailerForEach',
  // efficiency-nodes-comfyui: KSampler inputs, the Adv. variant names its
  // seed noise_seed like KSamplerAdvanced
  'KSampler (Efficient)',
  'KSampler Adv. (Efficient)',
  // ComfyUI-Easy-Use: KSampler inputs on a pipe
  'easy fullkSampler',
];

const LATENT_IMAGE_TYPES = ['EmptyLatentImage'];
const LATENT_IMAGE_RGTHREE_TYPES = ['SDXL Empty Latent Image (rgthree)'];
/**
 * Loaders that hold the prompts, the empty latent size and the clip skip
 * themselves (efficiency-nodes-comfyui, ComfyUI-Easy-Use): their
 * `positive` / `negative` inputs are the prompt strings, the size comes
 * from `empty_latent_width` / `empty_latent_height` (Easy-Use: overridden
 * by `resolution` unless that is a custom-size sentinel) and `clip_skip`
 * is CLIPSetLastLayer's stop_at_clip_layer
 */
const ALL_IN_ONE_LOADER_TYPES = ['Efficient Loader', 'easy fullLoader'];
const CHECKPOINT_TYPES = ['CheckpointLoaderSimple', 'CheckpointLoader'];
const UNET_LOADER_TYPES = ['UNETLoader'];
const CLIP_SET_LAST_LAYER_TYPES = ['CLIPSetLastLayer'];
const HIRES_MODEL_UPSCALE_TYPES = ['UpscaleModelLoader'];
const HIRES_IMAGE_SCALE_TYPES = ['ImageScale', 'ImageScaleBy'];
const LATENT_UPSCALE_TYPES = ['LatentUpscale', 'LatentUpscaleBy'];
const VAE_ENCODE_TYPES = ['VAEEncode', 'VAEEncodeTiled'];

/**
 * Empty-latent nodes by name: comfy-core calls them Empty<Model>LatentImage
 * or Empty<Model>LatentVideo (EmptySD3LatentImage, EmptyFlux2LatentImage,
 * EmptyHunyuanLatentVideo, ...)
 */
const EMPTY_LATENT_NAME = /^Empty\w*Latent/;

// =============================================================================
// Shape Fallbacks
// =============================================================================

/**
 * Whether a node outside SAMPLER_TYPES has the shape of a sampler
 *
 * Custom samplers (ImpactKSamplerBasicPipe, ...) keep the KSampler inputs:
 * `Sampler` in the class name, `steps` and a `seed` or `noise_seed`.
 * Selector nodes (KSamplerSelect) carry only a sampler name and do not
 * qualify.
 */
function hasSamplerShape(node: ComfyNode): boolean {
  // The graph may carry non-node entries (CivitAI's extraMetadata)
  return (
    typeof node?.class_type === 'string' &&
    node.class_type.includes('Sampler') &&
    node.inputs?.steps !== undefined &&
    (node.inputs.seed !== undefined || node.inputs.noise_seed !== undefined)
  );
}

/**
 * Known sampler node, or one recognized by shape
 */
function isSampler(node: ComfyNode): boolean {
  return SAMPLER_TYPES.includes(node.class_type) || hasSamplerShape(node);
}

/**
 * Whether a node is an empty-latent node by name with a literal size
 */
function hasEmptyLatentShape(node: ComfyNode): boolean {
  return (
    typeof node?.class_type === 'string' &&
    EMPTY_LATENT_NAME.test(node.class_type) &&
    typeof node.inputs?.width === 'number' &&
    typeof node.inputs.height === 'number'
  );
}

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
  allInOneLoader?: ComfyNode;
  checkpoint?: ComfyNode;
  unetLoader?: ComfyNode;
  clipSetLastLayer?: ComfyNode;
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
    } else if (!result.allInOneLoader && ALL_IN_ONE_LOADER_TYPES.includes(ct)) {
      result.allInOneLoader = node;
    } else if (!result.checkpoint && CHECKPOINT_TYPES.includes(ct)) {
      result.checkpoint = node;
    } else if (!result.unetLoader && UNET_LOADER_TYPES.includes(ct)) {
      result.unetLoader = node;
    } else if (
      !result.clipSetLastLayer &&
      CLIP_SET_LAST_LAYER_TYPES.includes(ct)
    ) {
      result.clipSetLastLayer = node;
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

  // Shape fallbacks, only for a role no known node filled
  if (!result.sampler) {
    result.sampler = Object.values(nodes).find(hasSamplerShape);
  }
  if (!result.latentImage && !result.latentImageRgthree) {
    result.latentImage = Object.values(nodes).find(hasEmptyLatentShape);
  }

  return result;
}

// =============================================================================
// Model Loaders
// =============================================================================

/**
 * The model loaders among the given nodes, first of each kind in graph order
 *
 * Used to take the model from the main sampler's upstream: a multi-stage
 * graph (Wan 2.2: a high-noise model, then a low-noise one) has a loader
 * per stage, and the first in the graph need not be the main sampler's.
 *
 * @param nodes - Full node graph
 * @param ids - Ids to consider (e.g. the main sampler's upstream)
 */
export function findModelLoaders(
  nodes: ComfyNodeGraph,
  ids: ReadonlySet<string>,
): { checkpoint?: ComfyNode; unetLoader?: ComfyNode } {
  const result: { checkpoint?: ComfyNode; unetLoader?: ComfyNode } = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (!ids.has(id)) continue;
    if (!result.checkpoint && CHECKPOINT_TYPES.includes(node.class_type)) {
      result.checkpoint = node;
    } else if (
      !result.unetLoader &&
      UNET_LOADER_TYPES.includes(node.class_type)
    ) {
      result.unetLoader = node;
    }
  }
  return result;
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
    (node) => isSampler(node) && isHiresSampler(nodes, node),
  );
}

// =============================================================================
// Graph Normalization
// =============================================================================

/**
 * Whether a parsed JSON value has the shape of an API prompt node
 */
function isComfyNode(value: unknown): value is ComfyNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { class_type, inputs } = value as Record<string, unknown>;
  return (
    typeof class_type === 'string' &&
    typeof inputs === 'object' &&
    inputs !== null &&
    !Array.isArray(inputs)
  );
}

/**
 * Keep the entries of a parsed prompt JSON that are nodes
 *
 * The API prompt format puts one node under each key, but a graph read
 * from a file may carry anything else as well: CivitAI's `extra` and
 * `extraMetadata` entries, a `null` left by a broken save, nodes without
 * `inputs` or with a non-string `class_type`. Those are dropped so the
 * walkers can rely on the {@link ComfyNode} shape. The graph has no
 * prototype, so a reference to an id such as "constructor" resolves to
 * nothing rather than to a property of Object.
 *
 * @param value - Parsed prompt JSON object
 * @returns The nodes, keyed as in the file
 */
export function toNodeGraph(value: Record<string, unknown>): ComfyNodeGraph {
  const graph: ComfyNodeGraph = Object.create(null);
  for (const [id, node] of Object.entries(value)) {
    if (isComfyNode(node)) graph[id] = node;
  }
  return graph;
}

// =============================================================================
// Node Reference Utilities
// =============================================================================

/**
 * Resolve a node reference to the target node
 */
export function resolveNode(
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
 * Resolve a boolean input that may be a literal or a reference to a
 * primitive node (e.g. PrimitiveBoolean) holding the literal in `value`.
 */
export function resolveBooleanInput(
  nodes: ComfyNodeGraph,
  value: unknown,
): boolean | undefined {
  if (typeof value === 'boolean') return value;
  const node = resolveNode(nodes, value);
  if (typeof node?.inputs.value === 'boolean') return node.inputs.value;
  return undefined;
}

/**
 * Resolve an input to the literal it carries at run time
 *
 * Follows references to primitive nodes (e.g. PrimitiveInt) holding the
 * literal in `value`, and ComfySwitchNode (comfy-core If/Else) to its
 * selected branch. Unlike prompt text, a switch whose state cannot be
 * resolved yields undefined: taking either branch could report a value
 * the run did not use. Callers check the literal's type, so an
 * unresolvable reference never surfaces as a value.
 */
export function resolveLiteralInput(
  nodes: ComfyNodeGraph,
  value: unknown,
  maxDepth = 10,
): unknown {
  if (!isNodeReference(value)) return value;
  const node = resolveNode(nodes, value);
  if (!node || maxDepth <= 0) return undefined;

  if (node.class_type === 'ComfySwitchNode') {
    const selected = resolveBooleanInput(nodes, node.inputs.switch);
    if (selected === undefined) return undefined;
    const branch = selected ? node.inputs.on_true : node.inputs.on_false;
    return resolveLiteralInput(nodes, branch, maxDepth - 1);
  }

  return node.inputs.value;
}

/**
 * Resolve a number input that may be a literal, a reference to a
 * primitive node (e.g. PrimitiveFloat) holding the literal in `value`,
 * or a ComfySwitchNode selecting between such inputs.
 */
export function resolveNumberInput(
  nodes: ComfyNodeGraph,
  value: unknown,
): number | undefined {
  const literal = resolveLiteralInput(nodes, value);
  return typeof literal === 'number' ? literal : undefined;
}

/**
 * Resolve a string input the same way as {@link resolveNumberInput}.
 */
export function resolveStringInput(
  nodes: ComfyNodeGraph,
  value: unknown,
): string | undefined {
  const literal = resolveLiteralInput(nodes, value);
  return typeof literal === 'string' ? literal : undefined;
}

// =============================================================================
// Reachability
// =============================================================================

/**
 * Ids of the nodes some nodes depend on
 *
 * Follows every node reference in the inputs upstream, so the set holds
 * everything that ran for those nodes: the model and clip chain, the
 * prompts and whatever feeds them. The starting nodes themselves are not
 * included.
 */
export function upstreamNodeIds(
  nodes: ComfyNodeGraph,
  starts: ComfyNode[],
): Set<string> {
  const seen = new Set<string>();
  const queue = starts.flatMap(referencedIds);
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes[id];
    if (node) queue.push(...referencedIds(node));
  }
  return seen;
}

/**
 * Ids of the nodes the inputs of a node reference
 */
function referencedIds(node: ComfyNode): string[] {
  if (!node.inputs || typeof node.inputs !== 'object') return [];
  return Object.values(node.inputs)
    .filter(isNodeReference)
    .map((ref) => String(ref[0]));
}
