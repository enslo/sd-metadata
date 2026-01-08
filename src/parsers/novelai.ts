import type {
  CharacterPrompt,
  NovelAIMetadata,
  ParseResult,
  PngTextChunk,
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
 * Parse NovelAI metadata from PNG chunks
 *
 * NovelAI stores metadata in tEXt chunks:
 * - Software: "NovelAI"
 * - Comment: JSON containing generation parameters
 *
 * @param chunks - PNG text chunks
 * @returns Parsed metadata or error
 */
export function parseNovelAI(chunks: PngTextChunk[]): ParseResult {
  // Build chunk map for easy access
  const chunkMap = new Map<string, string>();
  for (const chunk of chunks) {
    chunkMap.set(chunk.keyword, chunk.text);
  }

  // Verify NovelAI format
  if (chunkMap.get('Software') !== 'NovelAI') {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse Comment JSON
  const commentText = chunkMap.get('Comment');
  if (!commentText) {
    return Result.error({
      type: 'parseError',
      message: 'Missing Comment chunk',
    });
  }

  let comment: NovelAIComment;
  try {
    comment = JSON.parse(commentText);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in Comment chunk',
    });
  }

  // Extract dimensions (required)
  const width = comment.width;
  const height = comment.height;
  if (width === undefined || height === undefined) {
    return Result.error({
      type: 'parseError',
      message: 'Missing width or height in Comment',
    });
  }

  // Extract prompt - prefer V4 base_caption if available
  const prompt =
    comment.v4_prompt?.caption?.base_caption ?? comment.prompt ?? '';
  const negativePrompt =
    comment.v4_negative_prompt?.caption?.base_caption ?? comment.uc ?? '';

  // Build metadata
  const metadata: NovelAIMetadata = {
    software: 'novelai',
    prompt,
    negativePrompt,
    width,
    height,
    raw: chunks,
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
