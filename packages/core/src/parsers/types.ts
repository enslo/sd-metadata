import type { BaseMetadata, GenerationMetadata, Result } from '../types';

type ParseError =
  | { type: 'unsupportedFormat' }
  | { type: 'parseError'; message: string };

export type InternalParseResult = Result<GenerationMetadata, ParseError>;

/**
 * Partial metadata extracted from a single source.
 *
 * Same shape as {@link BaseMetadata} but every field is optional, so multiple
 * sources (structured node walk, CivitAI extraMetadata, flat-scan fallback)
 * can each contribute what they could resolve and let the caller merge them.
 */
export type PartialMetadata = Partial<BaseMetadata>;
