/**
 * Parse a dimension text such as "512x768"
 *
 * The text is read wherever a tool writes it (A1111's `Size`, Draw Things'
 * `size`). Anything that does not contain "<width>x<height>" yields zeros,
 * which the callers treat as "not recorded" (the image header fills the
 * dimensions in).
 *
 * @param value - Dimension text; a non-string yields zeros
 * @returns Width and height in pixels
 */
export function parseSize(value: unknown): { width: number; height: number } {
  const match = typeof value === 'string' ? /(\d+)x(\d+)/.exec(value) : null;
  if (!match) return { width: 0, height: 0 };
  return { width: Number(match[1] ?? 0), height: Number(match[2] ?? 0) };
}
