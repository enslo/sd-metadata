import type { GenerationMetadata, Result } from '../types';

type ParseError =
  | { type: 'unsupportedFormat' }
  | { type: 'parseError'; message: string };

export type InternalParseResult = Result<GenerationMetadata, ParseError>;
