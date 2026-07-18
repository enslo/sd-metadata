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
 * C2PA (Content Credentials) samples.
 *
 * These images carry only a signed C2PA manifest (in a PNG `caBX` chunk) and
 * NO generation parameters, so they are not handled by the SD-tool parsers.
 * They live in their own directory tree (samples/c2pa/<format>/), so the
 * generation-metadata sweeps never see them; they are exercised separately by
 * tests/samples/c2pa.test.ts.
 */
export const C2PA_PNG_SAMPLES = [
  { filename: 'chatgpt-image2.png', vendor: 'openai' },
  { filename: 'gemini_3.1pro.png', vendor: 'google' },
  { filename: 'gemini_unknown.png', vendor: 'google' },
] as const;

/**
 * Files with expected raw metadata mismatch in cross-format round-trips
 *
 * A PNG with `prompt`/`workflow` chunks now always writes the Make(0x010F)
 * "workflow:..." + Model(0x0110) "prompt:..." tag pair — byte-for-byte the
 * same layout the official Save Animated WEBP node writes, and the only one
 * ComfyUI's own frontend reads natively for WebP drag-and-drop (see
 * convertComfyUIPngToSegments). Sources that used a different JPEG/WebP
 * layout therefore can't stay raw-identical through a PNG round-trip:
 * - comfyui-save-image-extended: labelled, but Title Case and the opposite
 *   tag (ImageDescription "Workflow: " + Make "Prompt: ", with a space)
 * - comfyui-saveimage-plus: a single exifUserComment JSON envelope, not the
 *   labelled tag pair
 *
 * Any PNG chunk other than prompt/workflow (e.g. comfy-image-saver's
 * `parameters`, an A1111-compatible text rendering third-party save nodes
 * add) has no slot in that tag pair and is intentionally dropped, not
 * preserved through another channel:
 * - comfyui-comfy-image-saver
 * - comfyui-saveimagewithmetadata
 *
 * Parsed metadata should still match - only raw comparison is skipped.
 */
const RAW_MISMATCH_EXPECTED = [
  'comfyui-save-image-extended',
  'comfyui-saveimage-plus',
  'comfyui-comfy-image-saver',
  'comfyui-saveimagewithmetadata',
];

/**
 * Get the samples directory path for a given format
 */
function getSamplesDir(format: 'png' | 'jpg' | 'webp'): string {
  return path.join(__dirname, '../../../../samples', format);
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
 * Load a C2PA (Content Credentials) sample file as Uint8Array
 *
 * C2PA fixtures live under samples/c2pa/<format>/, separate from the
 * generation-metadata samples in samples/<format>/, so they are never picked
 * up by the generation sample sweeps.
 *
 * @param format - The image format
 * @param filename - The filename within samples/c2pa/<format>/
 * @returns The file contents as Uint8Array
 */
export function loadC2paSample(
  format: 'png' | 'jpg' | 'webp',
  filename: string,
): Uint8Array {
  const filePath = path.join(
    __dirname,
    '../../../../samples/c2pa',
    format,
    filename,
  );
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
