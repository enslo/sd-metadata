/**
 * Type-safe JSON parsing utilities
 */

import { Result } from '../types';

/**
 * Type-safe JSON parse with Result
 *
 * Wraps JSON.parse to return a Result type instead of throwing.
 * This enables const-only code without try-catch blocks.
 *
 * @param text - JSON string to parse
 * @returns Result with parsed value or parse error
 *
 * @example
 * const parsed = parseJson<MyType>(text);
 * if (!parsed.ok) return parsed;
 * const data = parsed.value;
 */
export function parseJson<T>(
  text: string,
): Result<T, { type: 'parseError'; message: string }> {
  try {
    return Result.ok(JSON.parse(text) as T);
  } catch {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON',
    });
  }
}
