import type {
  ComfyUIMetadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { parseComfyUI } from './comfyui';

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
 * - prompt: ComfyUI-compatible workflow JSON (primary source)
 * - parameters-json: JSON containing generation parameters
 *   - Used to override prompts (more complete than workflow)
 * - parameters: A1111-style text (fallback)
 * - smproj: Project data (not parsed here)
 *
 * Strategy:
 * 1. Parse as ComfyUI workflow (workflow, model, sampling, etc.)
 * 2. Override prompts from parameters-json (more complete)
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseStabilityMatrix(
  entries: MetadataEntry[],
): InternalParseResult {
  // Build entry record for easy access
  const entryRecord = buildEntryRecord(entries);

  // First, parse as ComfyUI workflow to get base metadata
  const comfyResult = parseComfyUI(entries);
  if (!comfyResult.ok || comfyResult.value.software !== 'comfyui') {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Override software to stability-matrix
  const metadata: Omit<ComfyUIMetadata, 'raw'> = {
    ...comfyResult.value,
    software: 'stability-matrix',
  };

  // Find parameters-json entry for prompt override
  const jsonText = entryRecord['parameters-json'];
  if (jsonText) {
    const parsed = parseJson<StabilityMatrixJson>(jsonText);
    if (parsed.ok) {
      const data = parsed.value;

      // Override prompts from parameters-json (more complete than workflow)
      if (data.PositivePrompt !== undefined) {
        metadata.prompt = data.PositivePrompt;
      }
      if (data.NegativePrompt !== undefined) {
        metadata.negativePrompt = data.NegativePrompt;
      }

      // Override model information from parameters-json
      if (data.ModelName !== undefined || data.ModelHash !== undefined) {
        metadata.model = {
          name: data.ModelName,
          hash: data.ModelHash,
        };
      }
    }
  }

  return Result.ok(metadata);
}
