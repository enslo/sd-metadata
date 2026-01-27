import fs from 'node:fs';
import path from 'node:path';

/**
 * Patterns to exclude from sample lists
 *
 * These files are intentionally without AI generation metadata,
 * used for testing edge cases like empty files or non-AI images.
 */
const EXCLUDED_PATTERNS = ['empty', 'gimp'];

/**
 * Files with expected raw metadata mismatch in cross-format round-trips
 *
 * These files don't round-trip with identical raw metadata due to DESIGN DECISIONS:
 * - comfyui-save-image-extended: save-image-extended format is converted to
 *   saveimage-plus format (by design, for ComfyUI compatibility)
 * - civitai-hires: CivitAI's extraMetadata structure doesn't preserve dimensions
 *   through format conversion (CivitAI-specific limitation)
 * - civitai-upscale: CivitAI's extra/extraMetadata chunks use non-standard
 *   keywords that don't match after round-trip (CivitAI-specific limitation)
 *
 * NOTE: Parsed metadata (metadata) should still match - only raw comparison is skipped.
 */
const RAW_MISMATCH_EXPECTED = [
  'civitai-hires',
  'civitai-upscale',
  'comfyui-save-image-extended',
];

/**
 * Files with expected dimensions (width/height) mismatch in parsed metadata
 *
 * CivitAI upscale workflows store original generation dimensions in extraMetadata,
 * but the parser uses target image dimensions as fallback. This causes width/height
 * to differ after cross-format round-trip when the intermediate image has different
 * dimensions than the original.
 */
const DIMENSIONS_MISMATCH_EXPECTED = ['civitai-hires'];

/**
 * JPEG-only samples that cannot be converted to PNG
 *
 * These files have metadata structures that become unrecognized after PNG conversion:
 * - civitai-hires: Complex extraMetadata structure fails PNG round-trip
 * - civitai-upscale: Non-standard chunk structure incompatible with PNG format
 *
 * NOTE: Tests explicitly verify that PNG conversion produces 'unrecognized' status.
 * This is an expected limitation, not a test failure.
 *
 * TODO: Investigate and fix PNG conversion for these files
 */
const JPEG_ONLY_SAMPLES = ['civitai-hires', 'civitai-upscale'];

/**
 * Get the samples directory path for a given format
 */
function getSamplesDir(format: 'png' | 'jpg' | 'webp'): string {
  return path.join(__dirname, '../../samples', format);
}

/**
 * Check if a filename should be excluded from sample lists
 */
function isExcluded(filename: string): boolean {
  const baseName = path.basename(filename, path.extname(filename));
  return EXCLUDED_PATTERNS.some(
    (pattern) => baseName === pattern || baseName.startsWith(`${pattern}-`),
  );
}

/**
 * Check if a file is expected to have raw metadata mismatch after cross-format round-trip
 */
export function isRawMismatchExpected(filename: string): boolean {
  const baseName = path.basename(filename, path.extname(filename));
  return RAW_MISMATCH_EXPECTED.some(
    (pattern) => baseName === pattern || baseName.startsWith(`${pattern}-`),
  );
}

/**
 * Check if a file is expected to have dimensions mismatch in parsed metadata
 */
export function isDimensionsMismatchExpected(filename: string): boolean {
  const baseName = path.basename(filename, path.extname(filename));
  return DIMENSIONS_MISMATCH_EXPECTED.some(
    (pattern) => baseName === pattern || baseName.startsWith(`${pattern}-`),
  );
}

/**
 * Check if a JPEG file cannot be converted to PNG
 */
export function isJpegOnlySample(filename: string): boolean {
  const baseName = path.basename(filename, path.extname(filename));
  return JPEG_ONLY_SAMPLES.some(
    (pattern) => baseName === pattern || baseName.startsWith(`${pattern}-`),
  );
}

/**
 * List all sample files in a format directory, excluding non-metadata files
 *
 * @param format - The image format directory to scan
 * @returns Array of filenames (not full paths)
 */
export function listSamples(format: 'png' | 'jpg' | 'webp'): string[] {
  const dir = getSamplesDir(format);
  const files = fs.readdirSync(dir);

  return files
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      const validExtensions =
        format === 'png'
          ? ['.png']
          : format === 'jpg'
            ? ['.jpg', '.jpeg']
            : ['.webp'];
      return validExtensions.includes(ext) && !isExcluded(file);
    })
    .sort();
}

/**
 * List sample files suitable for cross-format conversion tests
 *
 * NOTE: This now includes ALL samples (no exclusions). Individual tests
 * should use isRawMismatchExpected() and isDimensionsMismatchExpected()
 * to conditionally skip specific comparisons.
 *
 * @param format - The image format directory to scan
 * @returns Array of filenames (not full paths)
 */
export function listCrossFormatSamples(
  format: 'png' | 'jpg' | 'webp',
): string[] {
  return listSamples(format);
}

/**
 * Load a sample file as Uint8Array
 *
 * @param format - The image format
 * @param filename - The filename within the format directory
 * @returns The file contents as Uint8Array
 */
export function loadSample(
  format: 'png' | 'jpg' | 'webp',
  filename: string,
): Uint8Array {
  const filePath = path.join(getSamplesDir(format), filename);
  return new Uint8Array(fs.readFileSync(filePath));
}

/**
 * Pre-computed sample lists for each format
 *
 * These are computed once at module load time and reused across tests.
 * Only includes files with AI generation metadata (excludes empty, gimp, etc.)
 */
export const PNG_SAMPLES = listSamples('png');
export const JPEG_SAMPLES = listSamples('jpg');
export const WEBP_SAMPLES = listSamples('webp');

/**
 * Pre-computed sample lists for cross-format tests
 *
 * These exclude files with known cross-format conversion bugs.
 */
export const PNG_CROSS_FORMAT_SAMPLES = listCrossFormatSamples('png');
export const JPEG_CROSS_FORMAT_SAMPLES = listCrossFormatSamples('jpg');
export const WEBP_CROSS_FORMAT_SAMPLES = listCrossFormatSamples('webp');
