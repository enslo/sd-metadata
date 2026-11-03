import type {
  BaseMetadata,
  GenerationMetadata,
  Result,
  VendorInfo,
} from '../types';

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

/**
 * A vendor declaration as read from one source. The caller adds `media`,
 * since only it knows whether the file is an image or a video.
 */
export type VendorDeclaration = Omit<VendorInfo, 'media'>;
