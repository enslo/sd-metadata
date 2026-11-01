import type { ComfyNodeGraph, LoraSettings } from '../types';
import { Result } from '../types';
import { type EntryRecord, extractFromCommentJson } from '../utils/entries';
import { parseJson } from '../utils/json';
import { lora, optionalLoras, toWeight } from '../utils/lora';
import { trimObject } from '../utils/object';
import { extractComfyUIMetadata } from './comfyui';
import type { InternalParseResult } from './types';

/**
 * TensorArt generation_data JSON structure
 *
 * Only prompt, negativePrompt, baseModel and the LoRA entries of models are
 * used from generation_data. All other parameters (sampling, dimensions,
 * etc.) are extracted from the ComfyUI node graph, which provides more
 * complete information.
 */
interface TensorArtGenerationData {
  prompt?: string;
  negativePrompt?: string;
  baseModel?: {
    modelFileName?: string;
    hash?: string;
  };
  /** Every model that took part; LoRAs carry `type: "LORA"` */
  models?: Array<{
    type?: unknown;
    modelFileName?: unknown;
    weight?: unknown;
    hash?: unknown;
  }>;
}

/**
 * Read the LoRAs of `generation_data.models`
 *
 * `modelFileName` is the file name the LoRA was uploaded under (without
 * extension); `label` is its version label in the UI and `modelId` /
 * `modelFileId` are TensorArt's IDs, none of which are read. The node graph
 * names the same files `EMS-<id>-EMS.safetensors` in a LoraTagLoader tag.
 *
 * @param models - `models` list
 * @returns LoRAs in the order TensorArt listed them
 */
function extractLoras(models: unknown): LoraSettings[] {
  if (!Array.isArray(models)) return [];

  return models.flatMap((model) => {
    if (model?.type !== 'LORA') return [];
    const name = model.modelFileName;
    if (typeof name !== 'string' || name === '') return [];
    return [
      lora({
        name,
        weight: toWeight(model.weight),
        hash:
          typeof model.hash === 'string' && model.hash !== ''
            ? model.hash
            : undefined,
      }),
    ];
  });
}

/**
 * Parse TensorArt metadata from entries
 *
 * TensorArt stores metadata with:
 * - generation_data: JSON containing generation parameters
 * - prompt: ComfyUI-style node graph (workflow)
 *
 * Strategy: Delegate node graph parsing to the ComfyUI parser for sampling,
 * dimensions, hires, and upscale. Only prompt text, model info and LoRAs are
 * taken from generation_data, since TensorArt uses a custom checkpoint
 * loader (ECHOCheckpointLoaderSimple) that the standard ComfyUI parser
 * cannot detect.
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseTensorArt(entries: EntryRecord): InternalParseResult {
  // Find generation_data entry
  // PNG: stored in 'generation_data' chunk
  // JPEG/WebP (after conversion): stored in 'Comment' as {"generation_data": ..., "prompt": ...}
  const dataText =
    entries.generation_data ??
    extractFromCommentJson(entries, 'generation_data');
  const promptChunk =
    entries.prompt ?? extractFromCommentJson(entries, 'prompt');

  if (!dataText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON (TensorArt appends NUL characters)
  const cleanedText = dataText.replace(/\0+$/, '');
  const parsed = parseJson<TensorArtGenerationData>(cleanedText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in generation_data entry',
    });
  }
  const data = parsed.value;

  // Parse nodes from prompt chunk (required for TensorArt)
  if (!promptChunk) {
    return Result.error({ type: 'unsupportedFormat' });
  }
  const promptParsed = parseJson<ComfyNodeGraph>(promptChunk);
  if (!promptParsed.ok || promptParsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in prompt chunk',
    });
  }
  const nodes = promptParsed.value;

  // Delegate node parsing to ComfyUI parser
  const comfy = extractComfyUIMetadata(nodes);

  // Model from generation_data (ECHOCheckpointLoaderSimple is not detected by ComfyUI parser)
  const model = trimObject({
    name: data.baseModel?.modelFileName,
    hash: data.baseModel?.hash,
  });
  const loras = extractLoras(data.models);

  return Result.ok({
    software: 'tensorart',
    nodes,
    // Prompt from generation_data, fallback to nodes
    prompt: data.prompt ?? comfy?.prompt ?? '',
    negativePrompt: data.negativePrompt ?? comfy?.negativePrompt ?? '',
    // Dimensions from nodes, fallback to generation_data
    width: comfy?.width ?? 0,
    height: comfy?.height ?? 0,
    // Model from generation_data, fallback to nodes
    model: model ?? comfy?.model,
    // Sampling, hires, upscale entirely from nodes
    sampling: comfy?.sampling,
    hires: comfy?.hires,
    upscale: comfy?.upscale,
    ...optionalLoras(loras),
  });
}
