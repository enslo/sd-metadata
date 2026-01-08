import type { ComfyUIMetadata, ParseResult, PngTextChunk } from '../types';
import { Result } from '../types';

/**
 * ComfyUI node structure
 */
interface ComfyNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: { title?: string };
}

/**
 * ComfyUI prompt structure (node ID -> node)
 */
type ComfyPrompt = Record<string, ComfyNode>;

/**
 * Parse ComfyUI metadata from PNG chunks
 *
 * ComfyUI stores metadata in tEXt chunks:
 * - prompt: JSON containing node graph with inputs
 * - workflow: JSON containing the full workflow (not parsed here)
 *
 * @param chunks - PNG text chunks
 * @returns Parsed metadata or error
 */
export function parseComfyUI(chunks: PngTextChunk[]): ParseResult {
  // Find prompt chunk
  const promptChunk = chunks.find((c) => c.keyword === 'prompt');
  if (!promptChunk) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse prompt JSON
  let prompt: ComfyPrompt;
  try {
    prompt = JSON.parse(promptChunk.text);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in prompt chunk',
    });
  }

  // Verify it's ComfyUI format (has class_type)
  const nodes = Object.values(prompt);
  if (!nodes.some((node) => 'class_type' in node)) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Find key nodes
  const ksampler = findNodeByClass(prompt, [
    'KSampler',
    'KSamplerAdvanced',
    'SamplerCustom',
  ]);
  const positiveClip = findPositiveClipNode(prompt, ksampler);
  const negativeClip = findNegativeClipNode(prompt, ksampler);
  const checkpoint = findNodeByClass(prompt, [
    'CheckpointLoaderSimple',
    'CheckpointLoader',
  ]);
  const latentImage = findNodeByClass(prompt, [
    'EmptyLatentImage',
    'EmptySD3LatentImage',
  ]);

  // Extract dimensions from latent image or save image
  let width = 0;
  let height = 0;

  if (latentImage) {
    width = Number(latentImage.inputs.width) || 0;
    height = Number(latentImage.inputs.height) || 0;
  }

  // If no dimensions found, use defaults
  if (width === 0 || height === 0) {
    // Try to find from other sources or use placeholder
    width = width || 512;
    height = height || 512;
  }

  // Find workflow chunk
  const workflowChunk = chunks.find((c) => c.keyword === 'workflow');
  let workflow: unknown;
  if (workflowChunk) {
    try {
      workflow = JSON.parse(workflowChunk.text);
    } catch {
      // Ignore invalid workflow JSON
    }
  }

  // Build metadata
  const metadata: ComfyUIMetadata = {
    software: 'comfyui',
    prompt: extractText(positiveClip),
    negativePrompt: extractText(negativeClip),
    width,
    height,
    workflow,
    raw: chunks,
  };

  // Add model settings
  if (checkpoint) {
    const ckptName = checkpoint.inputs.ckpt_name;
    if (typeof ckptName === 'string') {
      metadata.model = {
        name: ckptName,
      };
    }
  }

  // Add sampling settings
  if (ksampler) {
    const inputs = ksampler.inputs;
    metadata.sampling = {
      seed: typeof inputs.seed === 'number' ? inputs.seed : undefined,
      steps: typeof inputs.steps === 'number' ? inputs.steps : undefined,
      cfg: typeof inputs.cfg === 'number' ? inputs.cfg : undefined,
      sampler:
        typeof inputs.sampler_name === 'string'
          ? inputs.sampler_name
          : undefined,
      scheduler:
        typeof inputs.scheduler === 'string' ? inputs.scheduler : undefined,
    };
  }

  return Result.ok(metadata);
}

/**
 * Find a node by class type (first match)
 */
function findNodeByClass(
  prompt: ComfyPrompt,
  classTypes: string[],
): ComfyNode | undefined {
  for (const node of Object.values(prompt)) {
    if (classTypes.includes(node.class_type)) {
      return node;
    }
  }
  return undefined;
}

/**
 * Find positive CLIP text encode node (connected to KSampler positive input)
 */
function findPositiveClipNode(
  prompt: ComfyPrompt,
  ksampler: ComfyNode | undefined,
): ComfyNode | undefined {
  if (!ksampler) return undefined;

  // KSampler has 'positive' input which is a link [nodeId, outputIndex]
  const positiveLink = ksampler.inputs.positive;
  if (Array.isArray(positiveLink) && positiveLink.length >= 1) {
    const nodeId = String(positiveLink[0]);
    return prompt[nodeId];
  }

  return undefined;
}

/**
 * Find negative CLIP text encode node (connected to KSampler negative input)
 */
function findNegativeClipNode(
  prompt: ComfyPrompt,
  ksampler: ComfyNode | undefined,
): ComfyNode | undefined {
  if (!ksampler) return undefined;

  const negativeLink = ksampler.inputs.negative;
  if (Array.isArray(negativeLink) && negativeLink.length >= 1) {
    const nodeId = String(negativeLink[0]);
    return prompt[nodeId];
  }

  return undefined;
}

/**
 * Extract text from CLIP text encode node
 */
function extractText(node: ComfyNode | undefined): string {
  if (!node) return '';

  const text = node.inputs.text;
  if (typeof text === 'string') {
    return text;
  }

  return '';
}
