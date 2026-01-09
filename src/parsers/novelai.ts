import type {
  CharacterPrompt,
  InternalParseResult,
  MetadataEntry,
  NovelAIMetadata,
} from '../types';
import { Result } from '../types';

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
export function parseNovelAI(entries: MetadataEntry[]): InternalParseResult {
  // Build entry map for easy access
  const entryMap = new Map<string, string>();
  for (const entry of entries) {
    entryMap.set(entry.keyword, entry.text);
  }

  // Verify NovelAI format
  if (entryMap.get('Software') !== 'NovelAI') {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse Comment JSON
  const commentText = entryMap.get('Comment');
  if (!commentText) {
    return Result.error({
      type: 'parseError',
      message: 'Missing Comment entry',
    });
  }

  let comment: NovelAIComment;
  try {
    comment = JSON.parse(commentText);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Comment entry',
    });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = comment.width ?? 0;
  const height = comment.height ?? 0;

  // Extract prompt - prefer V4 base_caption if available
  const prompt =
    comment.v4_prompt?.caption?.base_caption ?? comment.prompt ?? '';
  const negativePrompt =
    comment.v4_negative_prompt?.caption?.base_caption ?? comment.uc ?? '';

  // Build metadata
  const metadata: Omit<NovelAIMetadata, 'raw'> = {
    type: 'novelai',
    software: 'novelai',
    prompt,
    negativePrompt,
    width,
    height,
  };

  // Add sampling settings if present
  if (
    comment.steps !== undefined ||
    comment.scale !== undefined ||
    comment.seed !== undefined ||
    comment.noise_schedule !== undefined ||
    comment.sampler !== undefined
  ) {
    metadata.sampling = {
      steps: comment.steps,
      cfg: comment.scale,
      seed: comment.seed,
      sampler: comment.sampler,
      scheduler: comment.noise_schedule,
    };
  }

  // Extract V4 character prompts
  const charCaptions = comment.v4_prompt?.caption?.char_captions;
  if (charCaptions && charCaptions.length > 0) {
    metadata.characterPrompts = charCaptions
      .map((cc): CharacterPrompt | null => {
        if (!cc.char_caption) return null;
        return {
          prompt: cc.char_caption,
          center: cc.centers?.[0],
        };
      })
      .filter((cp): cp is CharacterPrompt => cp !== null);

    metadata.useCoords = comment.v4_prompt?.use_coords;
    metadata.useOrder = comment.v4_prompt?.use_order;
  }

  return Result.ok(metadata);
}
