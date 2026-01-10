/**
 * ComfyUI metadata parser
 *
 * Parses ComfyUI-format prompt data from node graphs.
 * Also handles Civitai extraMetadata fallbacks for upscale workflows.
 */

import type {
  ComfyUIMetadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { type EntryRecord, buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

// =============================================================================
// Types
// =============================================================================

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
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseComfyUI(entries: MetadataEntry[]): InternalParseResult {
  const entryRecord = buildEntryRecord(entries);

  // Find prompt JSON from various possible locations
  const promptText = findPromptJson(entryRecord);
  if (!promptText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse prompt JSON
  const parsed = parseJson<ComfyPrompt>(promptText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in prompt entry',
    });
  }
  const prompt = parsed.value;

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
  const positiveClip = findClipNode(prompt, ksampler, 'positive');
  const negativeClip = findClipNode(prompt, ksampler, 'negative');
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

  // Extract dimensions
  let width = latentImage ? Number(latentImage.inputs.width) || 0 : 0;
  let height = latentImage ? Number(latentImage.inputs.height) || 0 : 0;

  // Extract prompts from CLIP nodes
  let positiveText = extractText(positiveClip);
  let negativeText = extractText(negativeClip);

  // Apply Civitai extraMetadata fallbacks
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
  };

  // Add model settings
  if (checkpoint) {
    const ckptName = checkpoint.inputs.ckpt_name;
    if (typeof ckptName === 'string') {
      metadata.model = { name: ckptName };
    }
  } else if (extraMeta?.baseModel) {
    metadata.model = { name: extraMeta.baseModel };
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
    metadata.sampling = {
      seed: extraMeta.seed,
      steps: extraMeta.steps,
      cfg: extraMeta.cfgScale,
      sampler: extraMeta.sampler,
    };
  }

  // Add upscale settings from Civitai extraMetadata
  if (extraMeta?.transformations) {
    const upscaleTransform = extraMeta.transformations.find(
      (t) => t.type === 'upscale',
    );
    if (upscaleTransform) {
      const originalWidth = extraMeta.width ?? width;
      if (originalWidth > 0 && upscaleTransform.upscaleWidth) {
        const scale = upscaleTransform.upscaleWidth / originalWidth;
        metadata.upscale = {
          scale: Math.round(scale * 100) / 100,
        };
      }
    }
  }

  return Result.ok(metadata);
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
    return entryRecord.prompt;
  }

  // JPEG/WebP format: may be in various entries
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
      // Remove null terminators that some tools append
      const cleaned = candidate.replace(/\0+$/, '');
      const parsed = parseJson<Record<string, unknown>>(cleaned);
      if (!parsed.ok) continue;

      // Check if it's wrapped in {"prompt": {...}} format
      if (parsed.value.prompt && typeof parsed.value.prompt === 'object') {
        return JSON.stringify(parsed.value.prompt);
      }
      // Check for nodes with class_type
      const values = Object.values(parsed.value);
      if (values.some((v) => v && typeof v === 'object' && 'class_type' in v)) {
        return candidate;
      }
    }
  }

  return undefined;
}

// =============================================================================
// Node Finding
// =============================================================================

/**
 * Find a node by class type (first match)
 */
function findNodeByClass(
  prompt: ComfyPrompt,
  classTypes: string[],
): ComfyNode | undefined {
  return Object.values(prompt).find((node) =>
    classTypes.includes(node.class_type),
  );
}

/**
 * Find CLIP text encode node connected to KSampler input
 */
function findClipNode(
  prompt: ComfyPrompt,
  ksampler: ComfyNode | undefined,
  inputName: string,
): ComfyNode | undefined {
  if (!ksampler) return undefined;

  const link = ksampler.inputs[inputName];
  if (Array.isArray(link) && link.length >= 1) {
    const nodeId = String(link[0]);
    return prompt[nodeId];
  }

  return undefined;
}

// =============================================================================
// Text Extraction
// =============================================================================

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

// =============================================================================
// Civitai Extra Metadata
// =============================================================================

/**
 * Extract extraMetadata from ComfyUI prompt
 *
 * Civitai upscale workflows embed original generation params in extraMetadata field
 */
function extractExtraMetadata(
  prompt: ComfyPrompt,
): CivitaiExtraMetadata | undefined {
  const extraMetaField = (prompt as Record<string, unknown>).extraMetadata;
  if (typeof extraMetaField !== 'string') return undefined;

  const parsed = parseJson<CivitaiExtraMetadata>(extraMetaField);
  return parsed.ok ? parsed.value : undefined;
}
