/**
 * Raw structure verification helpers for format conversion tests
 *
 * Defines expected segment/chunk structure by software and provides
 * verification functions to validate conversion output.
 */

import { expect } from 'vitest';
import type {
  GenerationSoftware,
  MetadataSegmentSource,
  RawMetadata,
} from '../../src/types';

/**
 * Expected segment patterns for JPEG/WebP (exact match required)
 *
 * Some software produces different segment structures depending on the source.
 * Each array represents an acceptable pattern (any one pattern matching is OK).
 *
 * IMPORTANT: Matching is EXACT - actual segments must match one pattern exactly
 * (same elements, same count). Extra or missing segments will cause test failure.
 */
type SegmentPattern = MetadataSegmentSource['type'][];

const EXPECTED_TO_JPEG_WEBP: Record<GenerationSoftware, SegmentPattern[]> = {
  // NovelAI: Both ImageDescription and UserComment
  novelai: [['exifImageDescription', 'exifUserComment']],

  // A1111-family: UserComment only
  'sd-webui': [['exifUserComment']],
  'sd-next': [['exifUserComment']],
  forge: [['exifUserComment']],
  'forge-classic': [['exifUserComment']],
  'forge-neo': [['exifUserComment']],
  reforge: [['exifUserComment']],
  'easy-reforge': [['exifUserComment']],

  // ComfyUI-family: Either saveimage-plus OR save-image-extended format
  // saveimage-plus: exifUserComment
  // save-image-extended: exifImageDescription + exifMake
  comfyui: [['exifUserComment'], ['exifImageDescription', 'exifMake']],
  // TensorArt and Stability Matrix are PNG-native formats without JPEG/WebP variants.
  // sd-metadata converts them using the saveimage-plus format (exifUserComment).
  tensorart: [['exifUserComment']],
  'stability-matrix': [['exifUserComment']],

  // CivitAI: UserComment (JSON or A1111 text)
  civitai: [['exifUserComment']],

  // InvokeAI: UserComment (KV JSON)
  invokeai: [['exifUserComment']],

  // SwarmUI: UserComment + optional Make for node graph
  swarmui: [['exifUserComment'], ['exifUserComment', 'exifMake']],

  // Simple formats: UserComment only
  'hf-space': [['exifUserComment']],
  fooocus: [['exifUserComment']],
  'ruined-fooocus': [['exifUserComment']],
  easydiffusion: [['exifUserComment']],
};

/**
 * Expected PNG chunk patterns (exact match required)
 *
 * Some software produces different chunk structures depending on the source.
 * Each array represents an acceptable pattern (any one pattern matching is OK).
 *
 * IMPORTANT: Matching is EXACT - actual chunks must match one pattern exactly
 * (same keywords, same count). Extra or missing chunks will cause test failure.
 */
type ChunkPattern = string[];

const EXPECTED_TO_PNG: Partial<Record<GenerationSoftware, ChunkPattern[]>> = {
  // NovelAI: Full set of descriptive chunks
  novelai: [
    [
      'Title',
      'Description',
      'Software',
      'Source',
      'Generation time',
      'Comment',
    ],
  ],

  // A1111-family: parameters chunk
  'sd-webui': [['parameters']],
  'sd-next': [['parameters']],
  forge: [['parameters']],
  'forge-classic': [['parameters']],
  'forge-neo': [['parameters']],
  reforge: [['parameters']],
  'easy-reforge': [['parameters']],

  // ComfyUI-family: prompt + workflow chunks (or variant with extra chunks)
  comfyui: [
    ['prompt', 'workflow'],
    ['parameters', 'prompt', 'workflow'], // comfy-image-saver / saveimagewithmetadata variant
  ],

  // TensorArt: uses generation_data + prompt
  tensorart: [['generation_data', 'prompt']],

  // Stability Matrix: uses prompt + parameters + parameters-json + smproj
  'stability-matrix': [['prompt', 'parameters', 'parameters-json', 'smproj']],

  // CivitAI: Single chunk containing all metadata
  // - Orchestration format: all JSON in single "prompt" chunk
  // - A1111 format: parameters chunk
  civitai: [['prompt'], ['parameters']],

  // InvokeAI: invokeai_metadata + invokeai_graph
  invokeai: [['invokeai_metadata', 'invokeai_graph']],

  // SwarmUI: parameters (+ optional prompt for node graph)
  swarmui: [['parameters'], ['prompt', 'parameters']],

  // HF-Space: parameters
  'hf-space': [['parameters']],

  // Fooocus: parameters chunk
  fooocus: [['parameters']],

  // Ruined Fooocus: parameters chunk
  'ruined-fooocus': [['parameters']],

  // EasyDiffusion: varies based on input, no fixed expectation
  // easydiffusion: undefined - skip verification
};

/**
 * Check if two arrays have exactly the same elements (order-independent)
 */
function arraysExactMatch<T>(actual: T[], expected: T[]): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.every((val, idx) => val === sortedExpected[idx]);
}

/**
 * Check if actual segments exactly match any expected pattern (no extra, no missing)
 */
function matchesAnySegmentPattern(
  actualSources: MetadataSegmentSource['type'][],
  patterns: SegmentPattern[],
): boolean {
  return patterns.some((pattern) => arraysExactMatch(actualSources, pattern));
}

/**
 * Check if actual chunks exactly match any expected pattern (no extra, no missing)
 */
function matchesAnyChunkPattern(
  actualKeywords: string[],
  patterns: ChunkPattern[],
): boolean {
  return patterns.some((pattern) => arraysExactMatch(actualKeywords, pattern));
}

/**
 * Verify raw structure matches expected pattern for software and target format
 *
 * @param raw - Actual raw metadata from conversion
 * @param software - Source software identifier
 * @param targetFormat - Target format of conversion
 */
export function expectRawStructure(
  raw: RawMetadata,
  software: GenerationSoftware,
  targetFormat: 'png' | 'jpeg' | 'webp',
): void {
  if (targetFormat === 'png') {
    expect(raw.format).toBe('png');
    if (raw.format !== 'png') return;

    const expectedPatterns = EXPECTED_TO_PNG[software];
    if (!expectedPatterns) {
      // No specific expectations for this software (e.g., easydiffusion)
      return;
    }

    const actualKeywords = raw.chunks.map((c) => c.keyword);
    const matches = matchesAnyChunkPattern(actualKeywords, expectedPatterns);

    expect(
      matches,
      `Expected PNG chunks for ${software} to match one of: ${JSON.stringify(expectedPatterns)}. ` +
        `Actual: ${JSON.stringify(actualKeywords)}`,
    ).toBe(true);
  } else {
    // JPEG or WebP
    expect(raw.format).toBe(targetFormat);
    if (raw.format === 'png') return;

    const expectedPatterns = EXPECTED_TO_JPEG_WEBP[software];
    const actualSources = raw.segments.map((s) => s.source.type);
    const matches = matchesAnySegmentPattern(actualSources, expectedPatterns);

    expect(
      matches,
      `Expected segments for ${software} to match one of: ${JSON.stringify(expectedPatterns)}. ` +
        `Actual: ${JSON.stringify(actualSources)}`,
    ).toBe(true);
  }
}

/**
 * Get expected segment sources for a software when converting to JPEG/WebP
 */
export function getExpectedSegmentSources(
  software: GenerationSoftware,
): SegmentPattern[] {
  return EXPECTED_TO_JPEG_WEBP[software] ?? [['exifUserComment']];
}

/**
 * Get expected PNG chunk keywords for a software when converting from JPEG/WebP
 */
export function getExpectedPngKeywords(
  software: GenerationSoftware,
): ChunkPattern[] | undefined {
  return EXPECTED_TO_PNG[software];
}
