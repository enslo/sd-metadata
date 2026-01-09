import type {
  InternalParseResult,
  InvokeAIMetadata,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';

/**
 * InvokeAI metadata JSON structure
 */
interface InvokeAIMetadataJson {
  positive_prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg_scale?: number;
  scheduler?: string;
  model?: {
    name?: string;
    hash?: string;
  };
}

/**
 * Parse InvokeAI metadata from entries
 *
 * InvokeAI stores metadata with:
 * - invokeai_metadata: JSON containing generation parameters
 * - invokeai_graph: JSON containing the full node graph (not parsed here)
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseInvokeAI(entries: MetadataEntry[]): InternalParseResult {
  // Build entry record for easy access
  const entryRecord = buildEntryRecord(entries);

  // Find invokeai_metadata entry
  const metadataText = entryRecord.invokeai_metadata;
  if (!metadataText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse metadata JSON
  let data: InvokeAIMetadataJson;
  try {
    data = JSON.parse(metadataText);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in invokeai_metadata entry',
    });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.width ?? 0;
  const height = data.height ?? 0;

  // Build metadata
  const metadata: Omit<InvokeAIMetadata, 'raw'> = {
    type: 'invokeai',
    software: 'invokeai',
    prompt: data.positive_prompt ?? '',
    negativePrompt: data.negative_prompt ?? '',
    width,
    height,
  };

  // Add model settings
  if (data.model?.name || data.model?.hash) {
    metadata.model = {
      name: data.model.name,
      hash: data.model.hash,
    };
  }

  // Add sampling settings
  if (
    data.seed !== undefined ||
    data.steps !== undefined ||
    data.cfg_scale !== undefined ||
    data.scheduler !== undefined
  ) {
    metadata.sampling = {
      seed: data.seed,
      steps: data.steps,
      cfg: data.cfg_scale,
      sampler: data.scheduler,
    };
  }

  return Result.ok(metadata);
}
