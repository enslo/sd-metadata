/**
 * Object utility functions
 */

/**
 * Remove undefined values from an object
 *
 * Creates a new object with only defined (non-undefined) values.
 * Returns undefined if all values are undefined (empty result).
 * Useful for building metadata objects where undefined fields should be omitted.
 *
 * @example
 * trimObject({ a: 1, b: undefined, c: 'hello' })
 * // => { a: 1, c: 'hello' }
 *
 * trimObject({ a: undefined, b: undefined })
 * // => undefined
 *
 * @param obj - Object with potentially undefined values
 * @returns New object with undefined values removed, or undefined if empty
 */
export function trimObject<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> | undefined {
  const result = Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
  return Object.keys(result).length === 0 ? undefined : result;
}
