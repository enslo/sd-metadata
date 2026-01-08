import type { InvokeAIMetadata, ParseResult, PngTextChunk } from '../types';
import { Result } from '../types';

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
 * Parse InvokeAI metadata from PNG chunks
 *
 * InvokeAI stores metadata in tEXt/iTXt chunks:
 * - invokeai_metadata: JSON containing generation parameters
 * - invokeai_graph: JSON containing the full node graph (not parsed here)
 *
 * @param chunks - PNG text chunks
 * @returns Parsed metadata or error
 */
export function parseInvokeAI(chunks: PngTextChunk[]): ParseResult {
  // Find invokeai_metadata chunk
  const metadataChunk = chunks.find((c) => c.keyword === 'invokeai_metadata');
  if (!metadataChunk) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse metadata JSON
  let data: InvokeAIMetadataJson;
  try {
    data = JSON.parse(metadataChunk.text);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in invokeai_metadata chunk',
    });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.width ?? 0;
  const height = data.height ?? 0;

  // Build metadata
  const metadata: InvokeAIMetadata = {
    type: 'invokeai',
    software: 'invokeai',
    prompt: data.positive_prompt ?? '',
    negativePrompt: data.negative_prompt ?? '',
    width,
    height,
    raw: chunks,
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
