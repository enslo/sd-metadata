import type { ParseResult, PngMetadata } from '../types';
import { Result } from '../types';
import { parseA1111 } from './a1111';
import { parseComfyUI } from './comfyui';
import { parseNovelAI } from './novelai';

// Re-export individual parsers
export { parseA1111 } from './a1111';
export { parseComfyUI } from './comfyui';
export { parseNovelAI } from './novelai';

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

    // Currently unsupported formats
    case 'swarmui':
    case 'tensorart':
    case 'stability-matrix':
    case 'invokeai':
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

      // Finally try NovelAI
      const novelaiResult = parseNovelAI(chunks);
      if (novelaiResult.ok) return novelaiResult;

      return Result.error({ type: 'unsupportedFormat' });
    }
  }
}
