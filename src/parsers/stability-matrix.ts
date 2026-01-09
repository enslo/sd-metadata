import type {
  ComfyUIMetadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';

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
  // Build entry map for easy access
  const entryMap = new Map<string, string>();
  for (const entry of entries) {
    entryMap.set(entry.keyword, entry.text);
  }

  // Find parameters-json entry (preferred)
  const jsonText = entryMap.get('parameters-json');
  if (!jsonText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  let data: StabilityMatrixJson;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in parameters-json entry',
    });
  }

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
  const promptText = entryMap.get('prompt');
  if (promptText) {
    try {
      metadata.workflow = JSON.parse(promptText);
    } catch {
      // Ignore parse errors for workflow
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
