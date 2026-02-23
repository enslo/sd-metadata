import type { ComfyNodeGraph } from '../types';
import { Result } from '../types';
import { type EntryRecord, extractFromCommentJson } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import { extractComfyUIMetadata } from './comfyui';
import type { InternalParseResult } from './types';

/**
 * TensorArt generation_data JSON structure
 *
 * Only prompt, negativePrompt, and baseModel are used from generation_data.
 * All other parameters (sampling, dimensions, etc.) are extracted from the
 * ComfyUI node graph, which provides more complete information.
 */
interface TensorArtGenerationData {
  prompt?: string;
  negativePrompt?: string;
  baseModel?: {
    modelFileName?: string;
    hash?: string;
  };
}

/**
 * Parse TensorArt metadata from entries
 *
 * TensorArt stores metadata with:
 * - generation_data: JSON containing generation parameters
 * - prompt: ComfyUI-style node graph (workflow)
 *
 * Strategy: Delegate node graph parsing to the ComfyUI parser for sampling,
 * dimensions, hires, and upscale. Only prompt text and model info are taken
 * from generation_data, since TensorArt uses a custom checkpoint loader
 * (ECHOCheckpointLoaderSimple) that the standard ComfyUI parser cannot detect.
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
  });
}
