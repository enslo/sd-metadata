/**
 * Type-safe JSON parsing utilities
 */

/**
 * Discriminated union for JSON parse results.
 * Each variant contains the actual runtime type for proper narrowing.
 *
 * @typeParam T - Type for object values (default: Record<string, unknown>)
 */
export type JsonParseResult<T = Record<string, unknown>> =
  | { ok: true; type: 'object'; value: T }
  | { ok: true; type: 'array'; value: unknown[] }
  | { ok: true; type: 'string'; value: string }
  | { ok: true; type: 'number'; value: number }
  | { ok: true; type: 'boolean'; value: boolean }
  | { ok: true; type: 'null'; value: null }
  | { ok: false; error: { type: 'parseError'; message: string } };

/**
 * Type-safe JSON parse with discriminated union result.
 *
 * Returns a result that includes the runtime type of the parsed value,
 * enabling proper TypeScript narrowing without unsafe type assertions.
 *
 * @typeParam T - Expected object type (used when type === 'object')
 * @param text - JSON string to parse
 * @returns Discriminated union with parsed value and its type, or parse error
 *
 * @example
 * // Without type parameter - value is Record<string, unknown>
 * const parsed = parseJson(text);
 * if (!parsed.ok || parsed.type !== 'object') return null;
 * const name = parsed.value.name; // unknown
 *
 * @example
 * // With type parameter - value is the specified type
 * const parsed = parseJson<MyInterface>(text);
 * if (!parsed.ok || parsed.type !== 'object') return null;
 * const name = parsed.value.name; // typed!
 */
export function parseJson<T = Record<string, unknown>>(
  text: string,
): JsonParseResult<T> {
  try {
    const value: unknown = JSON.parse(text);
    return toJsonResult<T>(value);
  } catch {
    return {
      ok: false,
      error: { type: 'parseError', message: 'Invalid JSON' },
    };
  }
}

/**
 * Convert a parsed JSON value to a discriminated result
 */
function toJsonResult<T>(value: unknown): JsonParseResult<T> {
  if (value === null) {
    return { ok: true, type: 'null', value: null };
  }
  if (Array.isArray(value)) {
    return { ok: true, type: 'array', value };
  }
  switch (typeof value) {
    case 'object':
      return { ok: true, type: 'object', value: value as T };
    case 'string':
      return { ok: true, type: 'string', value };
    case 'number':
      return { ok: true, type: 'number', value };
    case 'boolean':
      return { ok: true, type: 'boolean', value };
    default:
      // Should never happen with valid JSON
      return {
        ok: false,
        error: { type: 'parseError', message: 'Unexpected JSON type' },
      };
  }
}
