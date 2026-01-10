import type {
  ComfyUIMetadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

/**
 * Stability Matrix parameters-json structure
 */
interface StabilityMatrixJson {
  PositivePrompt?: string;
  NegativePrompt?: string;
  Width?: number;
  Height?: number;
  Seed?: number;
  Steps?: number;
  CfgScale?: number;
  Sampler?: string;
  ModelName?: string;
  ModelHash?: string;
}

/**
 * Parse Stability Matrix metadata from entries
 *
 * Stability Matrix stores metadata with:
 * - parameters-json: JSON containing generation parameters
 * - parameters: A1111-style text (fallback)
 * - smproj: Project data (not parsed here)
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseStabilityMatrix(
  entries: MetadataEntry[],
): InternalParseResult {
  // Build entry record for easy access
  const entryRecord = buildEntryRecord(entries);

  // Find parameters-json entry (preferred)
  const jsonText = entryRecord['parameters-json'];
  if (!jsonText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  const parsed = parseJson<StabilityMatrixJson>(jsonText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in parameters-json entry',
    });
  }
  const data = parsed.value;

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.Width ?? 0;
  const height = data.Height ?? 0;

  // Build metadata
  const metadata: Omit<ComfyUIMetadata, 'raw'> = {
    type: 'comfyui',
    software: 'stability-matrix',
    prompt: data.PositivePrompt ?? '',
    negativePrompt: data.NegativePrompt ?? '',
    width,
    height,
  };

  // Extract ComfyUI-compatible workflow from prompt entry
  if (entryRecord.prompt) {
    const workflowParsed = parseJson<unknown>(entryRecord.prompt);
    if (workflowParsed.ok) {
      metadata.workflow = workflowParsed.value;
    }
  }

  // Add model settings
  if (data.ModelName || data.ModelHash) {
    metadata.model = {
      name: data.ModelName,
      hash: data.ModelHash,
    };
  }

  // Add sampling settings
  if (
    data.Seed !== undefined ||
    data.Steps !== undefined ||
    data.CfgScale !== undefined ||
    data.Sampler !== undefined
  ) {
    metadata.sampling = {
      seed: data.Seed,
      steps: data.Steps,
      cfg: data.CfgScale,
      sampler: data.Sampler,
    };
  }

  return Result.ok(metadata);
}
