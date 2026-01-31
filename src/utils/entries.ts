import { parseJson } from './json';

/**
 * Entry record type (readonly for immutability)
 *
 * Maps metadata keywords to their text values for O(1) lookup.
 */
export type EntryRecord = Readonly<Record<string, string>>;

/**
 * Extract a field from UserComment JSON
 *
 * Many parsers store metadata as JSON in the UserComment entry.
 * This utility extracts a specific field, handling both string and object values.
 *
 * @param entryRecord - Entry record from buildEntryRecord
 * @param key - JSON key to extract
 * @returns Extracted value as string, or undefined if not found
 *
 * @example
 * ```typescript
 * // UserComment: {"generation_data": "{...}", "other": {...}}
 * const data = extractFromCommentJson(entryRecord, 'generation_data');
 * // Returns the string value or JSON.stringify of object value
 * ```
 */
export function extractFromCommentJson(
  entryRecord: EntryRecord,
  key: string,
): string | undefined {
  if (!entryRecord.UserComment?.startsWith('{')) return undefined;

  const parsed = parseJson<Record<string, unknown>>(entryRecord.UserComment);
  if (!parsed.ok) return undefined;

  const value = parsed.value[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return undefined;
}
