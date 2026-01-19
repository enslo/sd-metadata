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
  const ksampler = findNode(prompt, ['Sampler']);

  // Extract prompts from CLIP nodes
  const positiveClip = findNode(prompt, ['PositiveCLIP_Base']);
  const negativeClip = findNode(prompt, ['NegativeCLIP_Base']);
  const clipPositiveText = extractText(positiveClip);
  const clipNegativeText = extractText(negativeClip);

  // Extract dimensions
  const latentImage = findNode(prompt, ['EmptyLatentImage']);
  const latentWidth = latentImage ? Number(latentImage.inputs.width) || 0 : 0;
  const latentHeight = latentImage ? Number(latentImage.inputs.height) || 0 : 0;

  // Apply Civitai extraMetadata fallbacks
  const extraMeta = extractExtraMetadata(prompt);
  const positiveText = clipPositiveText || extraMeta?.prompt || '';
  const negativeText = clipNegativeText || extraMeta?.negativePrompt || '';
  const width = latentWidth || extraMeta?.width || 0;
  const height = latentHeight || extraMeta?.height || 0;

  // Build metadata
  const metadata: Omit<ComfyUIMetadata, 'raw'> = {
    software: 'comfyui',
    prompt: positiveText,
    negativePrompt: negativeText,
    width,
    height,
    nodes: prompt, // Store the parsed node graph
  };

  // Add model settings
  const checkpoint = findNode(prompt, ['CheckpointLoader_Base'])?.inputs
    ?.ckpt_name;

  if (checkpoint) {
    metadata.model = { name: String(checkpoint) };
  } else if (extraMeta?.baseModel) {
    metadata.model = { name: extraMeta.baseModel };
  }

  // Add sampling settings
  if (ksampler) {
    metadata.sampling = {
      seed: ksampler.inputs.seed as number,
      steps: ksampler.inputs.steps as number,
      cfg: ksampler.inputs.cfg as number,
      sampler: ksampler.inputs.sampler_name as string,
      scheduler: ksampler.inputs.scheduler as string,
    };
  } else if (extraMeta) {
    metadata.sampling = {
      seed: extraMeta.seed,
      steps: extraMeta.steps,
      cfg: extraMeta.cfgScale,
      sampler: extraMeta.sampler,
    };
  }

  // Add HiresFix/Upscaler settings
  const hiresModel = findNode(prompt, [
    'HiresFix_ModelUpscale_UpscaleModelLoader',
    'PostUpscale_ModelUpscale_UpscaleModelLoader',
  ])?.inputs;
  const hiresScale = findNode(prompt, [
    'HiresFix_ImageScale',
    'PostUpscale_ImageScale',
  ])?.inputs;
  const hiresSampler = findNode(prompt, ['HiresFix_Sampler'])?.inputs;

  if (hiresModel && hiresScale) {
    // Calculate scale from HiresFix_ImageScale node
    const hiresWidth = hiresScale.width as number;
    const scale =
      latentWidth > 0
        ? Math.round((hiresWidth / latentWidth) * 100) / 100
        : undefined;

    if (hiresSampler) {
      metadata.hires = {
        upscaler: hiresModel.model_name as string,
        scale,
        steps: hiresSampler.steps as number,
        denoise: hiresSampler.denoise as number,
      };
    } else {
      metadata.upscale = {
        upscaler: hiresModel.model_name as string,
        scale,
      };
    }
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
    // Clean invalid JSON values that ComfyUI may include
    // - NaN is not valid in JSON spec (JavaScript only)
    // Replace NaN with null to make it parseable
    return entryRecord.prompt.replace(/:\s*NaN\b/g, ': null');
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
      // Clean invalid JSON values
      // - Remove null terminators that some tools append
      // - Replace NaN with null (NaN is not valid in JSON spec)
      const cleaned = candidate
        .replace(/\0+$/, '')
        .replace(/:\s*NaN\b/g, ': null');
      const parsed = parseJson<Record<string, unknown>>(cleaned);
      if (!parsed.ok) continue;

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
function findNode(prompt: ComfyPrompt, keys: string[]): ComfyNode | undefined {
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
