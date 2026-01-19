import type {
  InternalParseResult,
  InvokeAIMetadata,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

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
function extractInvokeAIMetadata(
  entryRecord: Record<string, string | undefined>,
): string | undefined {
  // Direct invokeai_metadata entry (PNG format)
  if (entryRecord.invokeai_metadata) {
    return entryRecord.invokeai_metadata;
  }

  // Try to extract from Comment JSON (JPEG/WebP format)
  if (!entryRecord.Comment) {
    return undefined;
  }

  const commentParsed = parseJson<Record<string, unknown>>(entryRecord.Comment);
  if (!commentParsed.ok || !('invokeai_metadata' in commentParsed.value)) {
    return undefined;
  }

  return JSON.stringify(commentParsed.value.invokeai_metadata);
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
  // For PNG: direct keyword
  // For JPEG/WebP: inside Comment JSON
  const metadataText = extractInvokeAIMetadata(entryRecord);

  if (!metadataText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse metadata JSON
  const parsed = parseJson<InvokeAIMetadataJson>(metadataText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in invokeai_metadata entry',
    });
  }
  const data = parsed.value;

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.width ?? 0;
  const height = data.height ?? 0;

  // Build metadata
  const metadata: Omit<InvokeAIMetadata, 'raw'> = {
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
