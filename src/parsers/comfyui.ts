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
 * ComfyUI workflow node structure (from workflow chunk)
 * Contains widgets_values which preserves original user input including comments
 */
interface ComfyWorkflowNode {
  id: string | number;
  type: string;
  widgets_values?: unknown[];
  inputs?: Array<{ name: string; type: string; link?: number | null }>;
  outputs?: Array<{ name: string; type: string; links?: number[] }>;
}

/**
 * ComfyUI workflow structure (from workflow chunk)
 */
interface ComfyWorkflow {
  nodes: ComfyWorkflowNode[];
  links?: unknown[];
}

/**
 * Build a map from node ID to workflow node
 *
 * @param workflow - Parsed workflow object
 * @returns Map of node ID (as string) to workflow node
 */
function buildWorkflowNodeMap(
  workflow: ComfyWorkflow,
): Map<string, ComfyWorkflowNode> {
  const map = new Map<string, ComfyWorkflowNode>();
  for (const node of workflow.nodes) {
    map.set(String(node.id), node);
  }
  return map;
}

/**
 * Extract text from workflow node's widgets_values
 * CLIPTextEncode nodes typically have text as the first widget value
 *
 * @param workflowNode - Workflow node to extract text from
 * @returns Extracted text or empty string
 */
function extractTextFromWorkflowNode(
  workflowNode: ComfyWorkflowNode | undefined,
): string {
  if (!workflowNode?.widgets_values) return '';

  // CLIPTextEncode: first widget is the text
  const firstWidget = workflowNode.widgets_values[0];
  if (typeof firstWidget === 'string') {
    return firstWidget;
  }

  return '';
}

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

  // Extract dimensions (fallback to 0 for IHDR extraction)
  let width = 0;
  let height = 0;

  if (latentImage) {
    width = Number(latentImage.inputs.width) || 0;
    height = Number(latentImage.inputs.height) || 0;
  }

  // Find workflow chunk and parse it
  const workflowChunk = chunks.find((c) => c.keyword === 'workflow');
  let workflow: ComfyWorkflow | undefined;
  let workflowNodeMap: Map<string, ComfyWorkflowNode> | undefined;

  if (workflowChunk) {
    try {
      const parsed = JSON.parse(workflowChunk.text);
      // Validate workflow structure
      if (parsed && Array.isArray(parsed.nodes)) {
        workflow = parsed as ComfyWorkflow;
        workflowNodeMap = buildWorkflowNodeMap(workflow);
      }
    } catch {
      // Ignore invalid workflow JSON
    }
  }

  // Extract prompts: prefer workflow widgets_values, fallback to prompt inputs
  const positiveNodeId = findNodeIdByLink(prompt, ksampler, 'positive');
  const negativeNodeId = findNodeIdByLink(prompt, ksampler, 'negative');

  let positiveText = '';
  let negativeText = '';

  // Try to get text from workflow (preserves comments)
  if (workflowNodeMap) {
    const positiveWorkflowNode = positiveNodeId
      ? workflowNodeMap.get(positiveNodeId)
      : undefined;
    const negativeWorkflowNode = negativeNodeId
      ? workflowNodeMap.get(negativeNodeId)
      : undefined;

    positiveText = extractTextFromWorkflowNode(positiveWorkflowNode);
    negativeText = extractTextFromWorkflowNode(negativeWorkflowNode);
  }

  // Fallback to prompt chunk if workflow extraction failed
  if (!positiveText) {
    positiveText = extractText(positiveClip);
  }
  if (!negativeText) {
    negativeText = extractText(negativeClip);
  }

  // Build metadata
  const metadata: ComfyUIMetadata = {
    type: 'comfyui',
    software: 'comfyui',
    prompt: positiveText,
    negativePrompt: negativeText,
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
 * Find node ID from KSampler input link
 *
 * @param prompt - Prompt data (not directly used, kept for consistency)
 * @param ksampler - KSampler node
 * @param inputName - Name of the input ('positive' or 'negative')
 * @returns Node ID as string, or undefined if not found
 */
function findNodeIdByLink(
  _prompt: ComfyPrompt,
  ksampler: ComfyNode | undefined,
  inputName: string,
): string | undefined {
  if (!ksampler) return undefined;

  const link = ksampler.inputs[inputName];
  if (Array.isArray(link) && link.length >= 1) {
    return String(link[0]);
  }

  return undefined;
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
