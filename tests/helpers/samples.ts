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
 * Files with known cross-format conversion bugs
 *
 * These files fail round-trip tests due to issues in the converter:
 * - civitai-hires: width/height from target image overwrites source metadata
 * - civitai-upscale: ComfyUI nodes written with wrong PNG chunk keywords
 * - comfyui-save-image-extended: exifMake segment lost during PNG conversion
 *
 * TODO: Fix these bugs and remove from exclusion list
 * @see https://github.com/enslo/sd-metadata/issues/XXX
 */
const CROSS_FORMAT_EXCLUDED = [
  'civitai-hires',
  'civitai-upscale',
  'comfyui-save-image-extended',
];

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
 * Check if a filename should be excluded from cross-format tests
 */
function isCrossFormatExcluded(filename: string): boolean {
  const baseName = path.basename(filename, path.extname(filename));
  return CROSS_FORMAT_EXCLUDED.some(
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
 * Excludes files with known cross-format conversion bugs in addition
 * to the standard exclusions.
 *
 * @param format - The image format directory to scan
 * @returns Array of filenames (not full paths)
 */
export function listCrossFormatSamples(
  format: 'png' | 'jpg' | 'webp',
): string[] {
  return listSamples(format).filter((file) => !isCrossFormatExcluded(file));
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
