import type { InternalParseResult } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseA1111 } from './a1111';
import { parseComfyUI } from './comfyui';
import { detectSoftware } from './detect';
import { parseEasyDiffusion } from './easydiffusion';
import { parseFooocus } from './fooocus';
import { parseHfSpace } from './hf-space';
import { parseInvokeAI } from './invokeai';
import { parseNovelAI } from './novelai';
import { parseRuinedFooocus } from './ruined-fooocus';
import { parseStabilityMatrix } from './stability-matrix';
import { parseSwarmUI } from './swarmui';
import { parseTensorArt } from './tensorart';

/**
 * Parse metadata entries to unified format
 *
 * Automatically detects the generation software and applies the appropriate parser.
 * This function returns metadata WITHOUT the `raw` field; callers should attach it.
 *
 * @param entries - Format-agnostic metadata entries
 * @returns Parsed metadata or error
 */
export function parseMetadata(entries: EntryRecord): InternalParseResult {
  // Detect software from entries
  const software = detectSoftware(entries);

  // Route to appropriate parser based on detected software
  switch (software) {
    case 'novelai':
      return parseNovelAI(entries);

    case 'sd-webui':
    case 'forge':
    case 'forge-classic':
    case 'forge-neo':
    case 'reforge':
    case 'easy-reforge':
    case 'sd-next':
      return parseA1111(entries, software);

    case 'hf-space':
      return parseHfSpace(entries);

    case 'civitai': {
      // Civitai uses ComfyUI JSON format with custom structure
      const comfyResult = parseComfyUI(entries);
      if (comfyResult.ok) {
        // Override software to preserve CivitAI detection
        comfyResult.value.software = 'civitai';
        return comfyResult;
      }
      // Fallback to A1111 format
      return parseA1111(entries, 'civitai');
    }

    case 'comfyui': {
      // ComfyUI can use either JSON or A1111 text format (e.g., comfy-image-saver)
      const comfyResult = parseComfyUI(entries);
      if (comfyResult.ok) return comfyResult;
      // Fallback to A1111 text format (treat as sd-webui since Version is absent)
      return parseA1111(entries, 'sd-webui');
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

    case 'fooocus':
      return parseFooocus(entries);

    case 'ruined-fooocus':
      return parseRuinedFooocus(entries);

    default:
      return Result.error({ type: 'unsupportedFormat' });
  }
}
