import type { CharacterPrompt } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import type { InternalParseResult } from './types';

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
  seed?: number | string;
  noise_schedule?: string;
  sampler?: string;
  /** img2img strength (Img2ImgRequest only) */
  strength?: number;
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
 * Opening of the text block the NovelAI web client adds for V5
 *
 * When the prompt quotes text and has no `Text:` of its own, the client
 * appends `, teXt: <quoted texts>` (separated by empty lines) so that
 * text rendering picks them up. The unusual casing tells it apart from a
 * `Text:` written by the user; `teXt::` is emphasis syntax instead.
 */
const AUTO_TEXT_PATTERN = /(?:^|[\s,.:[\]{}、。])teXt:(?!:)/;

/**
 * Remove the text block the NovelAI web client appended to a prompt
 *
 * The block is removed only when every text in it also appears in the
 * prompt before it or in a character prompt, which is where the client
 * collects them from. Anything else is kept as the user's own text.
 *
 * @param prompt - Base prompt as stored
 * @param characterPrompts - Character prompts the client also collects from
 * @returns Prompt without the appended block
 */
function stripAutoText(prompt: string, characterPrompts: string[]): string {
  const match = AUTO_TEXT_PATTERN.exec(prompt);
  if (!match) return prompt;

  const blockStart = match.index + match[0].length - 'teXt:'.length;
  const before = prompt.slice(0, blockStart);
  const texts = prompt
    .slice(match.index + match[0].length)
    .trim()
    .split('\n\n');
  const sources = [before, ...characterPrompts];
  const collected = texts.every(
    (text) => text !== '' && sources.some((source) => source.includes(text)),
  );
  return collected ? before.replace(/[\s,]+$/, '') : prompt;
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
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Comment entry',
    });
  }
  const comment = parsed.value;

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = comment.width ?? 0;
  const height = comment.height ?? 0;

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

  // Extract prompt - prefer V4 base_caption if available
  const prompt = stripAutoText(
    comment.v4_prompt?.caption?.base_caption ?? comment.prompt ?? '',
    characterPrompts?.map((cp) => cp.prompt) ?? [],
  );
  const negativePrompt =
    comment.v4_negative_prompt?.caption?.base_caption ?? comment.uc ?? '';

  return Result.ok({
    software: 'novelai',
    prompt,
    negativePrompt,
    width,
    height,
    sampling: trimObject({
      steps: comment.steps,
      cfg: comment.scale,
      seed: toSeedString(comment.seed),
      sampler: comment.sampler,
      scheduler: comment.noise_schedule,
      denoise: comment.strength,
    }),
    characterPrompts,
    useCoords: characterPrompts ? comment.v4_prompt?.use_coords : undefined,
    useOrder: characterPrompts ? comment.v4_prompt?.use_order : undefined,
  });
}
