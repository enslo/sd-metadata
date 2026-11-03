/**
 * Shared shape and limits of the video container readers
 */

import type { VideoRawMetadata, VideoTag } from '../types';

/** What a video reader extracts from a container. */
export interface VideoContainer {
  format: VideoRawMetadata['format'];
  /** Text metadata in file order */
  tags: VideoTag[];
  /** Video track width in pixels, 0 when unknown */
  width: number;
  /** Video track height in pixels, 0 when unknown */
  height: number;
  /** C2PA manifest store (JUMBF superbox labelled `c2pa`), if present */
  c2paStore?: Uint8Array;
  /** XMP packet text, if present */
  xmp?: string;
}

/**
 * Most bytes read for one box or element body. Real metadata bodies are a
 * few KB to tens of KB; anything larger is skipped rather than read, so a
 * malformed or hostile length cannot make the reader load a huge range.
 */
export const MAX_BODY_READ = 16 * 1024 * 1024;
