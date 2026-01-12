/**
 * Unified chunk encoding strategy for PNG converters
 *
 * Handles three different encoding strategies:
 * 1. dynamic: Choose tEXt/iTXt based on content (for tools like A1111, InvokeAI)
 * 2. text-unicode-escape: tEXt with Unicode escaping (for ComfyUI, SwarmUI)
 * 3. text-utf8-raw: tEXt with raw UTF-8 (for Stability Matrix, TensorArt)
 */

import type { PngTextChunk } from '../types';
import { createITxtChunk, createTextChunk } from './utils';

/**
 * Chunk encoding strategy for PNG converters
 */
export type ChunkEncodingStrategy =
  | 'dynamic' // Choose tEXt/iTXt based on content
  | 'text-unicode-escape' // tEXt with Unicode escape (spec-compliant)
  | 'text-utf8-raw'; // tEXt with raw UTF-8 (non-compliant but compatible)

/**
 * Tool-specific chunk encoding strategies
 */
const CHUNK_ENCODING_STRATEGIES: Record<string, ChunkEncodingStrategy> = {
  // Dynamic selection tools
  a1111: 'dynamic',
  forge: 'dynamic',
  'forge-neo': 'dynamic',
  'sd-webui': 'dynamic',
  invokeai: 'dynamic',
  novelai: 'dynamic',
  'sd-next': 'dynamic',
  easydiffusion: 'dynamic',
  blind: 'dynamic',

  // Unicode escape tools (spec-compliant)
  comfyui: 'text-unicode-escape',
  swarmui: 'text-unicode-escape',
  fooocus: 'text-unicode-escape',
  'ruined-fooocus': 'text-unicode-escape',
  'hf-space': 'text-unicode-escape',

  // Raw UTF-8 tools (non-compliant but compatible)
  'stability-matrix': 'text-utf8-raw',
  tensorart: 'text-utf8-raw',
};

/**
 * Get encoding strategy for a tool
 *
 * @param tool - Tool name
 * @returns Encoding strategy (defaults to 'text-unicode-escape')
 */
export function getEncodingStrategy(tool: string): ChunkEncodingStrategy {
  return CHUNK_ENCODING_STRATEGIES[tool] ?? 'text-unicode-escape';
}

/**
 * Escape Unicode characters beyond Latin-1 for tEXt chunk
 *
 * Converts characters beyond Latin-1 to Unicode escape sequences.
 * Latin-1 range (0x00-0xFF) is left as-is since tEXt supports it.
 * Example: テスト → \u30c6\u30b9\u30c8
 *
 * @param text - Text to escape
 * @returns Text with non-Latin-1 characters escaped
 */
export function escapeUnicode(text: string): string {
  return text.replace(/[\u0100-\uffff]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  });
}

/**
 * Check if text contains characters beyond Latin-1 range
 *
 * PNG tEXt chunks support Latin-1 (ISO 8859-1) encoding (0x00-0xFF).
 * Characters beyond this range require iTXt chunks for UTF-8 support.
 *
 * @param text - Text to check
 * @returns True if text contains characters outside Latin-1 range (>= 0x100)
 */
function hasNonLatin1(text: string): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: checking for non-Latin-1 characters
  return /[^\x00-\xFF]/.test(text);
}

/**
 * Create PNG chunk with appropriate encoding strategy
 *
 * @param keyword - Chunk keyword
 * @param text - Chunk text (undefined returns empty array)
 * @param strategy - Encoding strategy to use
 * @returns Array of PNG text chunks (empty if text is undefined)
 */
export function createEncodedChunk(
  keyword: string,
  text: string | undefined,
  strategy: ChunkEncodingStrategy,
): PngTextChunk[] {
  if (text === undefined) return [];

  switch (strategy) {
    case 'dynamic': {
      // Choose based on content: tEXt for Latin-1, iTXt for beyond
      const chunkType = hasNonLatin1(text) ? 'iTXt' : 'tEXt';
      return chunkType === 'iTXt'
        ? createITxtChunk(keyword, text)
        : createTextChunk(keyword, text);
    }

    case 'text-unicode-escape': {
      // tEXt with Unicode escaping (spec-compliant)
      const escaped = escapeUnicode(text);
      return createTextChunk(keyword, escaped);
    }

    case 'text-utf8-raw': {
      // tEXt with raw UTF-8 (non-compliant but compatible)
      return createTextChunk(keyword, text);
    }
  }
}
