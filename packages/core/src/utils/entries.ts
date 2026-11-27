import { type JsonParseResult, parseJson } from './json';

/**
 * Entry record type (readonly for immutability)
 *
 * Maps metadata keywords to their text values for O(1) lookup.
 */
export type EntryRecord = Readonly<Record<string, string>>;

/**
 * JSON parse results of entry texts, kept per record
 *
 * Building the record, detecting the software and parsing all look at the
 * same entries. An entry may hold megabytes of JSON (a ComfyUI workflow in
 * a WebP UserComment), so it is parsed once and the result is reused for as
 * long as the record lives.
 */
const parsedEntries = new WeakMap<
  EntryRecord,
  Map<string, { text: string; result: JsonParseResult }>
>();

/**
 * Parse the JSON text of an entry, once per record
 *
 * The result is shared between the callers, which must not modify it.
 *
 * @param entryRecord - Entry record
 * @param key - Entry keyword
 * @returns Parse result, or undefined when the record has no such entry
 */
export function parseEntryJson(
  entryRecord: EntryRecord,
  key: string,
): JsonParseResult | undefined {
  const text = entryRecord[key];
  if (text === undefined) return undefined;

  const cached = parsedEntries.get(entryRecord)?.get(key);
  if (cached?.text === text) return cached.result;

  return rememberEntryJson(entryRecord, key, text, parseJson(text));
}

/**
 * Keep the parse result of an entry text for {@link parseEntryJson}
 *
 * For a text that was parsed while the record was being built.
 *
 * @param entryRecord - Entry record, complete or under construction
 * @param key - Entry keyword
 * @param text - The text that was parsed
 * @param result - Its parse result
 * @returns The same parse result
 */
export function rememberEntryJson(
  entryRecord: EntryRecord,
  key: string,
  text: string,
  result: JsonParseResult,
): JsonParseResult {
  let cache = parsedEntries.get(entryRecord);
  if (!cache) {
    cache = new Map();
    parsedEntries.set(entryRecord, cache);
  }
  cache.set(key, { text, result });
  return result;
}

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

  const parsed = parseEntryJson(entryRecord, 'UserComment');
  if (!parsed?.ok || parsed.type !== 'object') return undefined;

  const value = parsed.value[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return undefined;
}
