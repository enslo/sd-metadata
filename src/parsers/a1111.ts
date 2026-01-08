import type { A1111Metadata, ParseResult, PngTextChunk } from '../types';
import { Result } from '../types';

/**
 * Parse A1111-format metadata from PNG chunks
 *
 * A1111 format is used by:
 * - Stable Diffusion WebUI (AUTOMATIC1111)
 * - Forge
 * - Forge Neo
 *
 * Format:
 * ```
 * positive prompt
 * Negative prompt: negative prompt
 * Steps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7, ...
 * ```
 *
 * @param chunks - PNG text chunks
 * @returns Parsed metadata or error
 */
export function parseA1111(chunks: PngTextChunk[]): ParseResult {
  // Find parameters chunk
  const parametersChunk = chunks.find((c) => c.keyword === 'parameters');
  if (!parametersChunk) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const text = parametersChunk.text;

  // Parse the text into sections
  const { prompt, negativePrompt, settings } = parseParametersText(text);

  // Parse settings key-value pairs
  const settingsMap = parseSettings(settings);

  // Extract dimensions (required)
  const size = settingsMap.get('Size');
  if (!size) {
    return Result.error({
      type: 'parseError',
      message: 'Missing Size in parameters',
    });
  }
  const [width, height] = parseSize(size);
  if (width === 0 || height === 0) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid Size format',
    });
  }

  // Determine software variant
  const version = settingsMap.get('Version');
  const software = detectSoftwareVariant(version);

  // Build metadata
  const metadata: A1111Metadata = {
    type: 'a1111',
    software,
    prompt,
    negativePrompt,
    width,
    height,
    raw: chunks,
  };

  // Add model settings
  const modelName = settingsMap.get('Model');
  const modelHash = settingsMap.get('Model hash');
  if (modelName || modelHash) {
    metadata.model = {
      name: modelName,
      hash: modelHash,
    };
  }

  // Add sampling settings
  const sampler = settingsMap.get('Sampler');
  const scheduler = settingsMap.get('Schedule type');
  const steps = parseNumber(settingsMap.get('Steps'));
  const cfg = parseNumber(settingsMap.get('CFG scale'));
  const seed = parseNumber(settingsMap.get('Seed'));
  const clipSkip = parseNumber(settingsMap.get('Clip skip'));

  if (
    sampler !== undefined ||
    scheduler !== undefined ||
    steps !== undefined ||
    cfg !== undefined ||
    seed !== undefined ||
    clipSkip !== undefined
  ) {
    metadata.sampling = {
      sampler,
      scheduler,
      steps,
      cfg,
      seed,
      clipSkip,
    };
  }

  // Add hires settings
  const hiresScale = parseNumber(settingsMap.get('Hires upscale'));
  const hiresUpscaler = settingsMap.get('Hires upscaler');
  const hiresSteps = parseNumber(settingsMap.get('Hires steps'));
  const denoise = parseNumber(settingsMap.get('Denoising strength'));

  if (
    hiresScale !== undefined ||
    hiresUpscaler !== undefined ||
    hiresSteps !== undefined ||
    denoise !== undefined
  ) {
    metadata.hires = {
      scale: hiresScale,
      upscaler: hiresUpscaler,
      steps: hiresSteps,
      denoise,
    };
  }

  return Result.ok(metadata);
}

/**
 * Parse parameters text into prompt, negative prompt, and settings
 */
function parseParametersText(text: string): {
  prompt: string;
  negativePrompt: string;
  settings: string;
} {
  // Find "Negative prompt:" marker
  const negativeIndex = text.indexOf('Negative prompt:');

  // Find the settings line (starts after the last newline before "Steps:")
  const stepsIndex = text.indexOf('Steps:');

  if (negativeIndex === -1 && stepsIndex === -1) {
    // No negative prompt, no settings - just prompt
    return { prompt: text.trim(), negativePrompt: '', settings: '' };
  }

  if (negativeIndex === -1) {
    // No negative prompt
    const settingsStart = text.lastIndexOf('\n', stepsIndex);
    return {
      prompt: text.slice(0, settingsStart).trim(),
      negativePrompt: '',
      settings: text.slice(settingsStart).trim(),
    };
  }

  if (stepsIndex === -1) {
    // No settings (unusual)
    return {
      prompt: text.slice(0, negativeIndex).trim(),
      negativePrompt: text.slice(negativeIndex + 16).trim(),
      settings: '',
    };
  }

  // Both exist: find where negative prompt ends and settings begin
  const settingsStart = text.lastIndexOf('\n', stepsIndex);

  return {
    prompt: text.slice(0, negativeIndex).trim(),
    negativePrompt: text.slice(negativeIndex + 16, settingsStart).trim(),
    settings: text.slice(settingsStart).trim(),
  };
}

/**
 * Parse settings line into key-value map
 *
 * Format: "Key1: value1, Key2: value2, ..."
 * Note: Values may contain commas (e.g., model names), so we parse carefully
 */
function parseSettings(settings: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!settings) return result;

  // Match "Key: value" pairs
  // Key is word characters (including spaces before colon)
  // Value continues until next "Key:" pattern or end
  const regex =
    /([A-Za-z][A-Za-z0-9 ]*?):\s*([^,]+?)(?=,\s*[A-Za-z][A-Za-z0-9 ]*?:|$)/g;

  let match = regex.exec(settings);
  while (match !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    result.set(key, value);
    match = regex.exec(settings);
  }

  return result;
}

/**
 * Parse "WxH" size string
 */
function parseSize(size: string): [number, number] {
  const match = size.match(/(\d+)x(\d+)/);
  if (!match) return [0, 0];
  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
}

/**
 * Parse number from string, returning undefined if invalid
 */
function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const num = Number.parseFloat(value);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Detect software variant from Version string
 */
function detectSoftwareVariant(
  version: string | undefined,
): 'sd-webui' | 'forge' | 'forge-neo' {
  if (!version) return 'sd-webui';
  if (version === 'neo') return 'forge-neo';
  if (version.startsWith('f')) return 'forge';
  return 'sd-webui';
}
