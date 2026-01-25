import type {
  BasicComfyUIMetadata,
  ComfyNodeGraph,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

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
export function parseTensorArt(entries: MetadataEntry[]): InternalParseResult {
  // Build entry record for easy access
  const entryRecord = buildEntryRecord(entries);

  // Find generation_data entry
  // PNG: stored in 'generation_data' chunk
  // JPEG/WebP (after conversion): stored in 'Comment' as {"generation_data": ..., "prompt": ...}
  let dataText = entryRecord.generation_data;
  let promptChunk = entryRecord.prompt;

  // Try to extract from Comment JSON (JPEG/WebP conversion case)
  if (!dataText && entryRecord.Comment?.startsWith('{')) {
    const commentParsed = parseJson<Record<string, unknown>>(
      entryRecord.Comment,
    );
    if (commentParsed.ok) {
      const commentData = commentParsed.value;
      if (typeof commentData.generation_data === 'string') {
        dataText = commentData.generation_data;
      } else if (typeof commentData.generation_data === 'object') {
        dataText = JSON.stringify(commentData.generation_data);
      }
      if (typeof commentData.prompt === 'string') {
        promptChunk = commentData.prompt;
      } else if (typeof commentData.prompt === 'object') {
        promptChunk = JSON.stringify(commentData.prompt);
      }
    }
  }

  if (!dataText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON (TensorArt appends NUL characters)
  const cleanedText = dataText.replace(/\0+$/, '');
  const parsed = parseJson<TensorArtGenerationData>(cleanedText);
  if (!parsed.ok) {
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
  const promptParsed = parseJson(promptChunk);
  if (!promptParsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in prompt chunk',
    });
  }

  // Build metadata
  const metadata: Omit<BasicComfyUIMetadata, 'raw'> = {
    software: 'tensorart',
    prompt: data.prompt ?? '',
    negativePrompt: data.negativePrompt ?? '',
    width,
    height,
    nodes: promptParsed.value as ComfyNodeGraph,
  };

  // Add model settings
  if (data.baseModel?.modelFileName || data.baseModel?.hash) {
    metadata.model = {
      name: data.baseModel.modelFileName,
      hash: data.baseModel.hash,
    };
  }

  // Add sampling settings
  if (
    data.seed !== undefined ||
    data.steps !== undefined ||
    data.cfgScale !== undefined ||
    data.clipSkip !== undefined
  ) {
    const baseSeed = data.seed ? Number(data.seed) : undefined;

    metadata.sampling = {
      seed:
        baseSeed === -1
          ? findActualSeed(promptParsed.value as ComfyNodeGraph)
          : baseSeed,
      steps: data.steps,
      cfg: data.cfgScale,
      clipSkip: data.clipSkip,
    };
  }

  return Result.ok(metadata);
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
