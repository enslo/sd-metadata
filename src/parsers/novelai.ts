import type { CharacterPrompt, InternalParseResult } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';

/**
 * NovelAI Comment JSON structure
 */
interface NovelAIComment {
  prompt: string;
  uc?: string;
  steps?: number;
  height?: number;
  width?: number;
  scale?: number;
  seed?: number;
  noise_schedule?: string;
  sampler?: string;
  /** V4 prompt structure */
  v4_prompt?: V4Prompt;
  /** V4 negative prompt structure */
  v4_negative_prompt?: V4Prompt;
}

/**
 * NovelAI V4 prompt structure
 */
interface V4Prompt {
  caption?: {
    base_caption?: string;
    char_captions?: Array<{
      char_caption?: string;
      centers?: Array<{ x: number; y: number }>;
    }>;
  };
  use_coords?: boolean;
  use_order?: boolean;
}

/**
 * Parse NovelAI metadata from entries
 *
 * NovelAI stores metadata with:
 * - Software: "NovelAI"
 * - Comment: JSON containing generation parameters
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseNovelAI(entries: EntryRecord): InternalParseResult {
  // Verify NovelAI format
  if (!entries.Software?.startsWith('NovelAI')) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse Comment JSON
  // NovelAI natively supports PNG and WebP, using Exif UserComment for JPEG/WebP.
  // COM segment (→ Comment) is a fallback for non-standard converted images.
  const commentText = entries.UserComment ?? entries.Comment;
  if (!commentText) {
    return Result.error({
      type: 'parseError',
      message: 'Missing Comment/UserComment entry',
    });
  }

  const parsed = parseJson<NovelAIComment>(commentText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Comment entry',
    });
  }
  const comment = parsed.value;

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = comment.width ?? 0;
  const height = comment.height ?? 0;

  // Extract prompt - prefer V4 base_caption if available
  const prompt =
    comment.v4_prompt?.caption?.base_caption ?? comment.prompt ?? '';
  const negativePrompt =
    comment.v4_negative_prompt?.caption?.base_caption ?? comment.uc ?? '';

  // Extract V4 character prompts
  const charCaptions = comment.v4_prompt?.caption?.char_captions;
  const characterPrompts =
    charCaptions && charCaptions.length > 0
      ? charCaptions
          .map((cc): CharacterPrompt | null => {
            if (!cc.char_caption) return null;
            return {
              prompt: cc.char_caption,
              center: cc.centers?.[0],
            };
          })
          .filter((cp): cp is CharacterPrompt => cp !== null)
      : undefined;

  return Result.ok({
    software: 'novelai',
    prompt,
    negativePrompt,
    width,
    height,
    sampling: trimObject({
      steps: comment.steps,
      cfg: comment.scale,
      seed: comment.seed,
      sampler: comment.sampler,
      scheduler: comment.noise_schedule,
    }),
    characterPrompts,
    useCoords: characterPrompts ? comment.v4_prompt?.use_coords : undefined,
    useOrder: characterPrompts ? comment.v4_prompt?.use_order : undefined,
  });
}
