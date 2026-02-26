import type { StandardMetadata } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import type { InternalParseResult } from './types';

/**
 * Draw Things metadata parser
 *
 * Draw Things (iOS/macOS) stores metadata in XMP format inside a PNG iTXt
 * chunk. The XMP is expanded to standard entries by the convert layer:
 * - CreatorTool: "Draw Things"
 * - UserComment: JSON with structured generation parameters
 * - parameters: A1111-like text from dc:description (fallback)
 *
 * The JSON in UserComment uses these key fields:
 * - c: positive prompt
 * - uc: negative prompt (unconditional)
 * - model: model filename
 * - sampler: sampler name
 * - scale: guidance scale (CFG)
 * - seed: seed value
 * - steps: number of steps
 * - strength: denoising strength
 * - size: image size (e.g., "960x1280")
 */

/**
 * Parse Draw Things metadata from entries
 *
 * @param entries - Metadata entries (XMP-expanded by convert layer)
 * @returns Parsed metadata or error
 */
export function parseDrawThings(entries: EntryRecord): InternalParseResult {
  // Primary: JSON from UserComment or Comment (JPEG/WebP conversion cases)
  const jsonText = entries.UserComment?.startsWith('{')
    ? entries.UserComment
    : entries.Comment?.startsWith('{')
      ? entries.Comment
      : undefined;
  if (!jsonText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const parsed = parseJson<Record<string, unknown>>(jsonText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Draw Things metadata',
    });
  }

  return buildMetadata(parsed.value);
}

/**
 * Parse image dimensions from "WxH" size string
 */
function parseSize(size: unknown): { width: number; height: number } {
  if (typeof size !== 'string') return { width: 0, height: 0 };
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return { width: 0, height: 0 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Build StandardMetadata from parsed Draw Things JSON
 */
function buildMetadata(data: Record<string, unknown>): InternalParseResult {
  const str = (key: string): string | undefined => {
    const v = data[key];
    return typeof v === 'string' ? v : undefined;
  };
  const num = (key: string): number | undefined => {
    const v = data[key];
    if (typeof v === 'number' && v !== 0) return v;
    return undefined;
  };

  const prompt = (str('c') ?? '').trim();
  const negativePrompt = (str('uc') ?? '').trim();
  const { width, height } = parseSize(data.size);

  const metadata: StandardMetadata = {
    software: 'draw-things',
    prompt,
    negativePrompt,
    width,
    height,
    model: trimObject({
      name: str('model'),
    }),
    sampling: trimObject({
      sampler: str('sampler'),
      steps: num('steps'),
      cfg: num('scale'),
      seed: num('seed'),
      denoise: num('strength'),
    }),
  };

  return Result.ok(metadata);
}
