import type { ComfyNodeGraph } from '../types';
import { Result } from '../types';
import { type EntryRecord, extractFromCommentJson } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import type { InternalParseResult } from './types';

/**
 * TensorArt generation_data JSON structure
 */
interface TensorArtGenerationData {
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: string;
  steps?: number;
  cfgScale?: number;
  clipSkip?: number;
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

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.width ?? 0;
  const height = data.height ?? 0;

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

  // Compute seed (resolve -1 from KSampler node)
  const baseSeed = data.seed ? Number(data.seed) : undefined;
  const seed = baseSeed === -1 ? findActualSeed(nodes) : baseSeed;

  return Result.ok({
    software: 'tensorart',
    prompt: data.prompt ?? '',
    negativePrompt: data.negativePrompt ?? '',
    width,
    height,
    nodes,
    model: trimObject({
      name: data.baseModel?.modelFileName,
      hash: data.baseModel?.hash,
    }),
    sampling: trimObject({
      seed,
      steps: data.steps,
      cfg: data.cfgScale,
      clipSkip: data.clipSkip,
    }),
  });
}

/**
 * Find actual seed value from KSampler node in ComfyUI node graph
 *
 * @param nodes - ComfyUI node graph
 * @returns Actual seed value, or -1 if not found
 */
function findActualSeed(nodes: ComfyNodeGraph): number {
  const samplerNode = findSamplerNode(nodes);
  return samplerNode && typeof samplerNode.inputs.seed === 'number'
    ? samplerNode.inputs.seed
    : -1;
}

/**
 * Find KSampler node in ComfyUI node graph
 *
 * @param nodes - ComfyUI node graph
 * @returns KSampler node or undefined
 */
function findSamplerNode(
  nodes: ComfyNodeGraph,
): { inputs: Record<string, unknown>; class_type: string } | undefined {
  return Object.values(nodes).find(
    (node) =>
      node.class_type === 'KSampler' ||
      node.class_type.toLowerCase().includes('sampler'),
  );
}
