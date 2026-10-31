import { expect } from 'vitest';
import type { MetadataSegment, RawMetadata } from '../../src/types';

/**
 * Options for raw metadata comparison
 */
export interface RawEqualOptions {
  /**
   * Tolerate a tEXt chunk coming back as iTXt when the restored text is not
   * Latin-1 (the only case in which the current writers emit iTXt)
   *
   * Some tools used to store non-Latin-1 text in tEXt chunks, a PNG spec
   * violation they later fixed by switching to iTXt. The converters emulate
   * the fixed writer, so files from the old version legitimately come back
   * with those chunks upgraded. Keyword, order, text (JSON-aware) and the
   * iTXt fields are still compared; a downgrade (iTXt → tEXt) or an upgrade
   * of Latin-1 text still fails.
   */
  allowItxtUpgrade?: boolean;
}

/**
 * Check if text contains characters beyond Latin-1 (the tEXt range)
 */
function hasNonLatin1(text: string): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: checking for non-Latin-1 characters
  return /[^\x00-\xFF]/.test(text);
}

/**
 * Compare two strings, treating them as JSON if possible
 *
 * If both strings are valid JSON, compare the parsed objects.
 * Otherwise, compare the strings directly.
 *
 * @param actual - Actual string
 * @param expected - Expected string
 */
export function expectJsonEqual(actual: string, expected: string): void {
  try {
    const actualJson = JSON.parse(actual);
    const expectedJson = JSON.parse(expected);
    expect(actualJson).toEqual(expectedJson);
  } catch {
    // Not valid JSON, compare as strings
    expect(actual).toBe(expected);
  }
}

/**
 * Compare raw metadata with JSON-aware comparison for chunk/segment text
 *
 * This is useful for round-trip tests where JSON formatting may differ
 * but the content should be equivalent.
 *
 * @param actual - Actual raw metadata
 * @param expected - Expected raw metadata
 * @param options - Tolerated differences, see RawEqualOptions
 */
export function expectRawEqual(
  actual: RawMetadata,
  expected: RawMetadata,
  options: RawEqualOptions = {},
): void {
  // Format must match
  expect(actual.format).toBe(expected.format);

  if (actual.format === 'png' && expected.format === 'png') {
    // Compare PNG chunks with JSON-aware text comparison
    expect(actual.chunks.length).toBe(expected.chunks.length);

    for (let i = 0; i < actual.chunks.length; i++) {
      const actualChunk = actual.chunks[i];
      const expectedChunk = expected.chunks[i];
      expect(actualChunk).toBeDefined();
      expect(expectedChunk).toBeDefined();
      if (!actualChunk || !expectedChunk) continue;

      expect(actualChunk.keyword).toBe(expectedChunk.keyword);

      if (
        options.allowItxtUpgrade &&
        expectedChunk.type === 'tEXt' &&
        actualChunk.type === 'iTXt' &&
        hasNonLatin1(actualChunk.text)
      ) {
        // Legacy tEXt holding non-Latin-1 text came back as the uncompressed,
        // untagged iTXt the current writer emits; only the type may differ
        expectJsonEqual(actualChunk.text, expectedChunk.text);
        expect(actualChunk.compressionFlag).toBe(0);
        expect(actualChunk.compressionMethod).toBe(0);
        expect(actualChunk.languageTag).toBe('');
        expect(actualChunk.translatedKeyword).toBe('');
        continue;
      }

      expect(actualChunk.type).toBe(expectedChunk.type);

      // Use JSON-aware comparison for text
      expectJsonEqual(actualChunk.text, expectedChunk.text);

      // For iTXt chunks, compare other fields
      if (actualChunk.type === 'iTXt' && expectedChunk.type === 'iTXt') {
        expect(actualChunk.compressionFlag).toBe(expectedChunk.compressionFlag);
        expect(actualChunk.compressionMethod).toBe(
          expectedChunk.compressionMethod,
        );
        expect(actualChunk.languageTag).toBe(expectedChunk.languageTag);
        expect(actualChunk.translatedKeyword).toBe(
          expectedChunk.translatedKeyword,
        );
      }
    }

    // The eXIf chunk is compared at the segment level (byte order and the
    // UserComment charset may differ between writers)
    expectSegmentsEqual(actual.exif ?? [], expected.exif ?? []);
  } else if (actual.format !== 'png' && expected.format !== 'png') {
    expectSegmentsEqual(actual.segments, expected.segments);
  }
}

/**
 * Compare segment lists with JSON-aware data comparison
 */
function expectSegmentsEqual(
  actual: MetadataSegment[],
  expected: MetadataSegment[],
): void {
  expect(actual.length).toBe(expected.length);

  for (let i = 0; i < actual.length; i++) {
    const actualSeg = actual[i];
    const expectedSeg = expected[i];

    expect(actualSeg?.source).toEqual(expectedSeg?.source);

    // Use JSON-aware comparison for data
    if (actualSeg && expectedSeg) {
      expectJsonEqual(actualSeg.data, expectedSeg.data);
    }
  }
}

/**
 * Compare raw metadata for NovelAI with special handling for corrected Description
 *
 * NovelAI WebP files have corrupted UTF-8 in the UserComment JSON Description field.
 * This library intentionally corrects it, so we validate:
 * - All UserComment JSON fields except Description match exactly
 * - Description is corrected (no null prefix, no corruption)
 * - Other segments (e.g., exifImageDescription) match exactly
 *
 * @param actual - Actual raw metadata
 * @param expected - Expected raw metadata
 */
export function expectNovelAIRawEqual(
  actual: RawMetadata,
  expected: RawMetadata,
): void {
  expect(actual.format).toBe(expected.format);

  if (actual.format === 'png' || expected.format === 'png') {
    throw new Error('NovelAI raw comparison is only for WebP/JPEG formats');
  }

  expect(actual.segments.length).toBe(expected.segments.length);

  for (let i = 0; i < actual.segments.length; i++) {
    const actualSeg = actual.segments[i];
    const expectedSeg = expected.segments[i];

    expect(actualSeg?.source).toEqual(expectedSeg?.source);

    // For exifUserComment: compare JSON fields except Description
    if (actualSeg?.source.type === 'exifUserComment' && expectedSeg) {
      try {
        const actualJson = JSON.parse(actualSeg.data);
        const expectedJson = JSON.parse(expectedSeg.data);

        // Check all fields except Description
        for (const key of Object.keys(expectedJson)) {
          if (key !== 'Description') {
            expect(actualJson[key]).toEqual(expectedJson[key]);
          }
        }

        // Description should be corrected (no corruption)
        expect(actualJson.Description).toBeTruthy();
        expect(actualJson.Description).not.toContain('\0\0\0\0');
      } catch {
        // If not JSON, compare directly
        expect(actualSeg.data).toBe(expectedSeg.data);
      }
    } else if (actualSeg && expectedSeg) {
      // For other segments (e.g., exifImageDescription), compare directly
      expect(actualSeg.data).toBe(expectedSeg.data);
    }
  }
}
