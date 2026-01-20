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
  const dataText = entryRecord.generation_data;
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
  const promptChunk = entryRecord.prompt;
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
    metadata.sampling = {
      seed: data.seed ? Number(data.seed) : undefined,
      steps: data.steps,
      cfg: data.cfgScale,
      clipSkip: data.clipSkip,
    };
  }

  return Result.ok(metadata);
}
