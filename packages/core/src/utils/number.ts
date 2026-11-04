/**
 * Read a number written as a number or as text
 *
 * JSON tools write numbers; SwarmUI, RuinedFooocus and Easy Diffusion PNG
 * chunks and Dezgo's YAML write text. Anything else, blank text or a
 * non-finite value yields undefined.
 */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  return typeof value === 'string' ? parseNumberText(value) : undefined;
}

/**
 * Parse a number written as text; blank or non-numeric text yields undefined
 */
export function parseNumberText(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}
