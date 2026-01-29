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
 * These files have intentional raw differences due to format normalization:
 * - comfyui-save-image-extended: Converted to saveimage-plus format for ComfyUI compatibility
 *
 * Parsed metadata should still match - only raw comparison is skipped.
 */
const RAW_MISMATCH_EXPECTED = ['comfyui-save-image-extended'];

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
 *
 * Returns true for files that have intentional raw differences due to format normalization.
 * Parsed metadata should still match - only raw comparison is skipped for these files.
 */
export function isRawMismatchExpected(filename: string): boolean {
  const baseName = path.basename(filename, path.extname(filename));
  return RAW_MISMATCH_EXPECTED.some(
    (pattern) => baseName === pattern || baseName.startsWith(`${pattern}-`),
  );
}

/**
 * List all sample files in a format directory, excluding non-metadata files
 *
 * @param format - The image format directory to scan
 * @returns Array of filenames (not full paths)
 */
function listSamples(format: 'png' | 'jpg' | 'webp'): string[] {
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
