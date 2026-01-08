import type { ComfyUIMetadata, ParseResult, PngTextChunk } from '../types';
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
 * Parse Stability Matrix metadata from PNG chunks
 *
 * Stability Matrix stores metadata in tEXt chunks:
 * - parameters-json: JSON containing generation parameters
 * - parameters: A1111-style text (fallback)
 * - smproj: Project data (not parsed here)
 *
 * @param chunks - PNG text chunks
 * @returns Parsed metadata or error
 */
export function parseStabilityMatrix(chunks: PngTextChunk[]): ParseResult {
  // Find parameters-json chunk (preferred)
  const jsonChunk = chunks.find((c) => c.keyword === 'parameters-json');
  if (!jsonChunk) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  let data: StabilityMatrixJson;
  try {
    data = JSON.parse(jsonChunk.text);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in parameters-json chunk',
    });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = data.Width ?? 0;
  const height = data.Height ?? 0;

  // Build metadata
  const metadata: ComfyUIMetadata = {
    type: 'comfyui',
    software: 'stability-matrix',
    prompt: data.PositivePrompt ?? '',
    negativePrompt: data.NegativePrompt ?? '',
    width,
    height,
    raw: chunks,
  };

  // Extract ComfyUI-compatible workflow from prompt chunk
  const promptChunk = chunks.find((c) => c.keyword === 'prompt');
  if (promptChunk) {
    try {
      metadata.workflow = JSON.parse(promptChunk.text);
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
