import type { ComfyUIMetadata, ParseResult, PngTextChunk } from '../types';
import { Result } from '../types';

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
 * Re-interpret Latin-1 encoded string as UTF-8
 *
 * TensorArt incorrectly stores UTF-8 bytes in tEXt chunks (which use Latin-1).
 * This function converts the corrupted string back to proper UTF-8.
 */
function fixLatin1ToUtf8(text: string): string {
  try {
    const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return text;
  }
}

/**
 * Parse TensorArt metadata from PNG chunks
 *
 * TensorArt stores metadata in tEXt chunks:
 * - generation_data: JSON containing generation parameters
 * - prompt: ComfyUI-style node graph (workflow)
 *
 * @param chunks - PNG text chunks
 * @returns Parsed metadata or error
 */

export function parseTensorArt(chunks: PngTextChunk[]): ParseResult {
  // Find generation_data chunk
  const dataChunk = chunks.find((c) => c.keyword === 'generation_data');
  if (!dataChunk) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON (trim NUL characters, fix Latin-1/UTF-8 encoding issue)
  let data: TensorArtGenerationData;
  try {
    const text = fixLatin1ToUtf8(dataChunk.text.replace(/\0+$/, ''));
    data = JSON.parse(text);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in generation_data chunk',
    });
  }

  // Extract dimensions
  const width = data.width ?? 0;
  const height = data.height ?? 0;
  if (width === 0 || height === 0) {
    return Result.error({
      type: 'parseError',
      message: 'Missing width or height in generation_data',
    });
  }

  // Build metadata
  const metadata: ComfyUIMetadata = {
    software: 'tensorart',
    prompt: data.prompt ?? '',
    negativePrompt: data.negativePrompt ?? '',
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
