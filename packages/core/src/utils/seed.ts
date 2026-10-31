/**
 * Seed normalization
 *
 * Seeds are opaque identifiers, not quantities: nobody adds or compares
 * them, they are displayed, copied and fed back to the generator. Several
 * tools (Fooocus among them) use 64-bit seeds that exceed
 * `Number.MAX_SAFE_INTEGER` (2^53 - 1), so representing them as JavaScript
 * numbers silently rounds the value. The library therefore carries seeds as
 * decimal strings end to end.
 */

/**
 * Normalize a raw seed value to its canonical string form
 *
 * - Numbers are stringified as-is (callers that already lost precision
 *   through `JSON.parse` cannot recover it here).
 * - Strings are trimmed and returned unchanged.
 * - Anything else (missing, null, NaN, non-finite, empty, node references)
 *   yields `undefined`.
 *
 * @param value - Raw seed from text or JSON metadata
 * @returns Seed as a decimal string, or `undefined` when absent
 */
export function toSeedString(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return undefined;
}
