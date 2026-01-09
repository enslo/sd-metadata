import type {
  ComfyUIMetadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';

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
  let data: TensorArtGenerationData;
  try {
    const text = dataText.replace(/\0+$/, '');
    data = JSON.parse(text);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in generation_data entry',
    });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.width ?? 0;
  const height = data.height ?? 0;

  // Build metadata
  const metadata: Omit<ComfyUIMetadata, 'raw'> = {
    type: 'comfyui',
    software: 'tensorart',
    prompt: data.prompt ?? '',
    negativePrompt: data.negativePrompt ?? '',
    width,
    height,
  };

  // Extract ComfyUI-compatible workflow from prompt entry
  const promptText = entryRecord.prompt;
  if (promptText) {
    try {
      metadata.workflow = JSON.parse(promptText);
    } catch {
      // Ignore parse errors for workflow
    }
  }

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
