import type { InternalParseResult } from '../types';
import { Result } from '../types';
import { type EntryRecord, extractFromCommentJson } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';

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
 * Extract InvokeAI metadata from entry record
 *
 * Checks direct 'invokeai_metadata' entry first, then tries to extract from Comment JSON
 */
function extractInvokeAIMetadata(entryRecord: EntryRecord): string | undefined {
  return (
    entryRecord.invokeai_metadata ??
    extractFromCommentJson(entryRecord, 'invokeai_metadata')
  );
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
export function parseInvokeAI(entries: EntryRecord): InternalParseResult {
  // Find invokeai_metadata entry
  // For PNG: direct keyword
  // For JPEG/WebP: inside Comment JSON
  const metadataText = extractInvokeAIMetadata(entries);

  if (!metadataText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse metadata JSON
  const parsed = parseJson<InvokeAIMetadataJson>(metadataText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in invokeai_metadata entry',
    });
  }
  const data = parsed.value;

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.width ?? 0;
  const height = data.height ?? 0;

  return Result.ok({
    software: 'invokeai',
    prompt: data.positive_prompt ?? '',
    negativePrompt: data.negative_prompt ?? '',
    width,
    height,
    model: trimObject({
      name: data.model?.name,
      hash: data.model?.hash,
    }),
    sampling: trimObject({
      seed: data.seed,
      steps: data.steps,
      cfg: data.cfg_scale,
      sampler: data.scheduler,
    }),
  });
}
