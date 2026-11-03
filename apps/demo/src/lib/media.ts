import type { ParseResult, VideoParseResult } from '@enslo/sd-metadata';

/**
 * A parse result together with the kind of file it came from: images go
 * through parse(), videos through parseVideo().
 */
export type LoadedResult =
  | { media: 'image'; parseResult: ParseResult }
  | { media: 'video'; parseResult: VideoParseResult };

/** Video containers parseVideo() reads, by MIME type. */
export const VIDEO_MIME_TYPES: Record<string, string[]> = {
  'video/mp4': ['.mp4', '.m4v'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
  'video/x-matroska': ['.mkv'],
};

/**
 * Whether a file should be read as a video. The extension is checked too,
 * since browsers often report MKV with an empty or generic MIME type.
 */
export function isVideoFile(file: File): boolean {
  if (Object.hasOwn(VIDEO_MIME_TYPES, file.type)) return true;
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return Object.values(VIDEO_MIME_TYPES).some((extensions) =>
    extensions.includes(extension),
  );
}
