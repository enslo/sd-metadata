import type { MetadataEntry } from '../types';

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
