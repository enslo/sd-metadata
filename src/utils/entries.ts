import type { MetadataEntry } from '../types';
import { parseJson } from './json';

/**
 * Entry record type (readonly for immutability)
 */
export type EntryRecord = Readonly<Record<string, string>>;

/**
 * Build an immutable record from metadata entries for keyword lookup
 *
 * @param entries - Array of metadata entries
 * @returns Readonly record mapping keyword to text
 *
 * @example
 * ```typescript
 * const record = buildEntryRecord(entries);
 * const comment = record['Comment'];  // string | undefined
 * ```
 */
export function buildEntryRecord(entries: MetadataEntry[]): EntryRecord {
  return Object.freeze(
    Object.fromEntries(entries.map((e) => [e.keyword, e.text])),
  );
}

/**
 * Extract a field from Comment JSON
 *
 * Many parsers store metadata as JSON in the Comment entry.
 * This utility extracts a specific field, handling both string and object values.
 *
 * @param entryRecord - Entry record from buildEntryRecord
 * @param key - JSON key to extract
 * @returns Extracted value as string, or undefined if not found
 *
 * @example
 * ```typescript
 * // Comment: {"generation_data": "{...}", "other": {...}}
 * const data = extractFromCommentJson(entryRecord, 'generation_data');
 * // Returns the string value or JSON.stringify of object value
 * ```
 */
export function extractFromCommentJson(
  entryRecord: EntryRecord,
  key: string,
): string | undefined {
  if (!entryRecord.Comment?.startsWith('{')) return undefined;

  const parsed = parseJson<Record<string, unknown>>(entryRecord.Comment);
  if (!parsed.ok) return undefined;

  const value = parsed.value[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return undefined;
}
