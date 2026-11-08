/**
 * Text trimming helpers that run in linear time
 *
 * The regular expressions they replace (`/\0+$/`, `/[ \t]+$/`) are tried
 * from every position of the text, so a long run of the trimmed character
 * followed by anything else made them quadratic in the text length.
 */

/**
 * Remove NUL characters from the end of the text
 *
 * Some tools pad PNG text chunks and Matroska strings with NULs.
 */
export function trimTrailingNul(text: string): string {
  return trimTrailing(text, (code) => code === 0);
}

/**
 * Remove spaces and tabs from the end of the text, keeping line breaks
 */
export function trimTrailingBlanks(text: string): string {
  return trimTrailing(text, (code) => code === 0x20 || code === 0x09);
}

function trimTrailing(
  text: string,
  matches: (code: number) => boolean,
): string {
  let end = text.length;
  while (end > 0 && matches(text.charCodeAt(end - 1))) end--;
  return end === text.length ? text : text.slice(0, end);
}
