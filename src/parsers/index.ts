import type { InternalParseResult, MetadataEntry } from '../types';
import { Result } from '../types';
import { parseA1111 } from './a1111';
import { parseComfyUI } from './comfyui';
import { detectSoftware } from './detect';
import { parseEasyDiffusion } from './easydiffusion';
import { parseHfSpace } from './hf-space';
import { parseInvokeAI } from './invokeai';
import { parseNovelAI } from './novelai';
import { parseStabilityMatrix } from './stability-matrix';
import { parseSwarmUI } from './swarmui';
import { parseTensorArt } from './tensorart';

// Re-export individual parsers
export { parseA1111 } from './a1111';
export { parseEasyDiffusion } from './easydiffusion';
export { parseHfSpace } from './hf-space';
export { parseComfyUI } from './comfyui';
export { detectSoftware } from './detect';
export { parseInvokeAI } from './invokeai';
export { parseNovelAI } from './novelai';
export { parseStabilityMatrix } from './stability-matrix';
export { parseSwarmUI } from './swarmui';
export { parseTensorArt } from './tensorart';

/**
 * Parse metadata entries to unified format
 *
 * Automatically detects the generation software and applies the appropriate parser.
 * This function returns metadata WITHOUT the `raw` field; callers should attach it.
 *
 * @param entries - Format-agnostic metadata entries
 * @returns Parsed metadata or error
 */
export function parseMetadata(entries: MetadataEntry[]): InternalParseResult {
  // Detect software from entries
  const software = detectSoftware(entries);

  // Route to appropriate parser based on detected software
  switch (software) {
    case 'novelai':
      return parseNovelAI(entries);

    case 'sd-webui':
    case 'forge':
    case 'forge-neo':
      return parseA1111(entries);

    case 'hf-space':
      return parseHfSpace(entries);

    case 'civitai': {
      // Civitai can use either ComfyUI JSON or A1111 text format
      const comfyResult = parseComfyUI(entries);
      if (comfyResult.ok) return comfyResult;
      return parseA1111(entries);
    }

    case 'comfyui': {
      // ComfyUI can use either JSON or A1111 text format (e.g., comfy-image-saver)
      const comfyResult = parseComfyUI(entries);
      if (comfyResult.ok) return comfyResult;
      return parseA1111(entries);
    }

    case 'invokeai':
      return parseInvokeAI(entries);

    case 'swarmui':
      return parseSwarmUI(entries);

    case 'tensorart':
      return parseTensorArt(entries);

    case 'stability-matrix':
      return parseStabilityMatrix(entries);

    case 'easydiffusion':
      return parseEasyDiffusion(entries);

    default: {
      // Try each parser in order
      // First try A1111 format (most common)
      const a1111Result = parseA1111(entries);
      if (a1111Result.ok) return a1111Result;

      // Then try ComfyUI
      const comfyResult = parseComfyUI(entries);
      if (comfyResult.ok) return comfyResult;

      // Then try InvokeAI
      const invokeResult = parseInvokeAI(entries);
      if (invokeResult.ok) return invokeResult;

      // Then try SwarmUI
      const swarmResult = parseSwarmUI(entries);
      if (swarmResult.ok) return swarmResult;

      // Then try TensorArt
      const tensorResult = parseTensorArt(entries);
      if (tensorResult.ok) return tensorResult;

      // Then try Stability Matrix
      const stabilityResult = parseStabilityMatrix(entries);
      if (stabilityResult.ok) return stabilityResult;

      // Finally try NovelAI
      const novelaiResult = parseNovelAI(entries);
      if (novelaiResult.ok) return novelaiResult;

      return Result.error({ type: 'unsupportedFormat' });
    }
  }
}
