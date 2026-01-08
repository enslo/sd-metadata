import type { ParseResult, PngMetadata } from '../types';
import { Result } from '../types';
import { parseA1111 } from './a1111';
import { parseComfyUI } from './comfyui';
import { parseInvokeAI } from './invokeai';
import { parseNovelAI } from './novelai';
import { parseStabilityMatrix } from './stability-matrix';
import { parseSwarmUI } from './swarmui';
import { parseTensorArt } from './tensorart';

// Re-export individual parsers
export { parseA1111 } from './a1111';
export { parseComfyUI } from './comfyui';
export { parseInvokeAI } from './invokeai';
export { parseNovelAI } from './novelai';
export { parseStabilityMatrix } from './stability-matrix';
export { parseSwarmUI } from './swarmui';
export { parseTensorArt } from './tensorart';

/**
 * Parse PNG metadata to unified format
 *
 * Automatically detects the generation software and applies the appropriate parser.
 *
 * @param metadata - PNG metadata from readPngMetadata
 * @returns Parsed metadata or error
 */
export function parseMetadata(metadata: PngMetadata): ParseResult {
  const { software, chunks } = metadata;

  // Route to appropriate parser based on detected software
  switch (software) {
    case 'novelai':
      return parseNovelAI(chunks);

    case 'sd-webui':
    case 'forge':
    case 'forge-neo':
      return parseA1111(chunks);

    case 'comfyui':
      return parseComfyUI(chunks);

    case 'invokeai':
      return parseInvokeAI(chunks);

    case 'swarmui':
      return parseSwarmUI(chunks);

    case 'tensorart':
      return parseTensorArt(chunks);

    case 'stability-matrix':
      return parseStabilityMatrix(chunks);

    // Currently unsupported formats
    case 'animagine':
      return Result.error({ type: 'unsupportedFormat' });

    default: {
      // Try each parser in order
      // First try A1111 format (most common)
      const a1111Result = parseA1111(chunks);
      if (a1111Result.ok) return a1111Result;

      // Then try ComfyUI
      const comfyResult = parseComfyUI(chunks);
      if (comfyResult.ok) return comfyResult;

      // Then try InvokeAI
      const invokeResult = parseInvokeAI(chunks);
      if (invokeResult.ok) return invokeResult;

      // Then try SwarmUI
      const swarmResult = parseSwarmUI(chunks);
      if (swarmResult.ok) return swarmResult;

      // Then try TensorArt
      const tensorResult = parseTensorArt(chunks);
      if (tensorResult.ok) return tensorResult;

      // Then try Stability Matrix
      const stabilityResult = parseStabilityMatrix(chunks);
      if (stabilityResult.ok) return stabilityResult;

      // Finally try NovelAI
      const novelaiResult = parseNovelAI(chunks);
      if (novelaiResult.ok) return novelaiResult;

      return Result.error({ type: 'unsupportedFormat' });
    }
  }
}
