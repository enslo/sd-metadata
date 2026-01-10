import type {
  ComfyUIMetadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { type EntryRecord, buildEntryRecord } from '../utils/entries';

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
 * ComfyUI workflow node structure (from workflow entry)
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
 * ComfyUI workflow structure (from workflow entry)
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
 * Find ComfyUI prompt JSON from entry record
 *
 * PNG uses 'prompt', JPEG/WebP may use Comment, Description, or Make.
 * This function returns the first valid ComfyUI prompt JSON found.
 *
 * @param entryRecord - Entry record to search
 * @returns Prompt JSON string or undefined
 */
function findPromptJson(entryRecord: EntryRecord): string | undefined {
  // PNG format: prompt entry
  if (entryRecord.prompt) {
    return entryRecord.prompt;
  }

  // JPEG/WebP format: may be in various entries
  // - Comment: from jpegCom or exifUserComment
  // - Description/Make: from exifImageDescription/exifMake (no prefix)
  // - Prompt: from exifMake with "Prompt:" prefix (save-image-extended)
  // - Workflow: from exifImageDescription with "Workflow:" prefix
  const candidates = [
    entryRecord.Comment,
    entryRecord.Description,
    entryRecord.Make,
    entryRecord.Prompt, // save-image-extended uses this
    entryRecord.Workflow, // Not a prompt, but may contain nodes info
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    // Check if it's JSON that looks like ComfyUI prompt
    if (candidate.startsWith('{')) {
      try {
        // Remove null terminators that some tools append
        const cleaned = candidate.replace(/\0+$/, '');
        const parsed = JSON.parse(cleaned);
        // Check if it's a prompt object (has nodes with class_type)
        // or wrapped in {"prompt": {...}} format
        if (parsed.prompt && typeof parsed.prompt === 'object') {
          // Wrapped format: {"prompt": {...}}
          return JSON.stringify(parsed.prompt);
        }
        // Check for nodes with class_type
        const values = Object.values(parsed);
        if (
          values.some(
            (v: unknown) =>
              v && typeof v === 'object' && 'class_type' in (v as object),
          )
        ) {
          return candidate;
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  return undefined;
}

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
 * Extract extraMetadata from ComfyUI prompt
 *
 * Civitai upscale workflows embed original generation params in extraMetadata field
 *
 * @param prompt - ComfyUI prompt object
 * @returns Parsed extraMetadata or undefined
 */
function extractExtraMetadata(
  prompt: ComfyPrompt,
): CivitaiExtraMetadata | undefined {
  // extraMetadata is stored as a JSON string in the prompt object
  const extraMetaField = (prompt as Record<string, unknown>).extraMetadata;
  if (typeof extraMetaField !== 'string') return undefined;

  try {
    return JSON.parse(extraMetaField);
  } catch {
    return undefined;
  }
}

/**
 * Parse ComfyUI metadata from entries
 *
 * ComfyUI stores metadata with:
 * - prompt: JSON containing node graph with inputs
 * - workflow: JSON containing the full workflow (not parsed here)
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseComfyUI(entries: MetadataEntry[]): InternalParseResult {
  // Build entry record for easy access
  const entryRecord = buildEntryRecord(entries);

  // Find prompt entry from various possible keywords
  // PNG uses 'prompt', JPEG/WebP may use Comment, Description, or Make
  const promptText = findPromptJson(entryRecord);
  if (!promptText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse prompt JSON
  let prompt: ComfyPrompt;
  try {
    prompt = JSON.parse(promptText);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in prompt entry',
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
    'KSampler (Efficient)',
  ]);
  const positiveClip = findPositiveClipNode(prompt, ksampler);
  const negativeClip = findNegativeClipNode(prompt, ksampler);
  const checkpoint = findNodeByClass(prompt, [
    'CheckpointLoaderSimple',
    'CheckpointLoader',
    'Checkpoint Loader (Simple)',
    'unCLIPCheckpointLoader',
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

  // Find workflow entry and parse it
  const workflowText = entryRecord.workflow;
  let workflow: ComfyWorkflow | undefined;
  let workflowNodeMap: Map<string, ComfyWorkflowNode> | undefined;

  if (workflowText) {
    try {
      const parsed = JSON.parse(workflowText);
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

  // Fallback to prompt entry if workflow extraction failed
  if (!positiveText) {
    positiveText = extractText(positiveClip);
  }
  if (!negativeText) {
    negativeText = extractText(negativeClip);
  }

  // Try extraMetadata as last fallback (Civitai upscale workflows)
  const extraMeta = extractExtraMetadata(prompt);
  if (extraMeta) {
    if (!positiveText && extraMeta.prompt) {
      positiveText = extraMeta.prompt;
    }
    if (!negativeText && extraMeta.negativePrompt) {
      negativeText = extraMeta.negativePrompt;
    }
    if (width === 0 && extraMeta.width) {
      width = extraMeta.width;
    }
    if (height === 0 && extraMeta.height) {
      height = extraMeta.height;
    }
  }

  // Build metadata
  const metadata: Omit<ComfyUIMetadata, 'raw'> = {
    type: 'comfyui',
    software: 'comfyui',
    prompt: positiveText,
    negativePrompt: negativeText,
    width,
    height,
    workflow,
  };

  // Add model settings
  if (checkpoint) {
    const ckptName = checkpoint.inputs.ckpt_name;
    if (typeof ckptName === 'string') {
      metadata.model = {
        name: ckptName,
      };
    }
  } else if (extraMeta?.baseModel) {
    // Fallback to extraMetadata for model settings (Civitai upscale workflows)
    metadata.model = {
      name: extraMeta.baseModel,
    };
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
  } else if (extraMeta) {
    // Fallback to extraMetadata for sampling settings (Civitai upscale workflows)
    metadata.sampling = {
      seed: extraMeta.seed,
      steps: extraMeta.steps,
      cfg: extraMeta.cfgScale,
      sampler: extraMeta.sampler,
      clipSkip: extraMeta.clipSkip,
    };
  }

  // Add upscale settings from extraMetadata (Civitai upscale workflows)
  if (extraMeta?.transformations) {
    const upscaleTransform = extraMeta.transformations.find(
      (t) => t.type === 'upscale',
    );
    if (upscaleTransform) {
      // Calculate scale factor from original and upscaled dimensions
      const originalWidth = extraMeta.width ?? width;
      if (originalWidth > 0 && upscaleTransform.upscaleWidth) {
        const scale = upscaleTransform.upscaleWidth / originalWidth;
        metadata.upscale = {
          scale: Math.round(scale * 100) / 100, // Round to 2 decimal places
        };
      }
    }
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
 *
 * Supports both standard CLIPTextEncode (text input) and
 * CLIPTextEncodeSDXL (text_g / text_l inputs).
 *
 * For SDXL:
 * - If text_g and text_l are identical, returns one of them
 * - If different, combines them as "text_g,\ntext_l"
 */
function extractText(node: ComfyNode | undefined): string {
  if (!node) return '';

  // Standard CLIPTextEncode: single text input
  const text = node.inputs.text;
  if (typeof text === 'string') {
    return text;
  }

  // CLIPTextEncodeSDXL: text_g and text_l inputs
  const textG = node.inputs.text_g;
  const textL = node.inputs.text_l;

  if (typeof textG === 'string' || typeof textL === 'string') {
    const g = typeof textG === 'string' ? textG : '';
    const l = typeof textL === 'string' ? textL : '';

    // If both are the same (or one is empty), return just one
    if (g === l || !g) return l;
    if (!l) return g;

    // If different, combine with comma and newline (matching SD Prompt Reader)
    return `${g},\n${l}`;
  }

  return '';
}
