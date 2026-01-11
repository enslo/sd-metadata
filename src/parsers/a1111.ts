import type {
  A1111Metadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';

/**
 * Parse A1111-format metadata from entries
 *
 * A1111 format is used by:
 * - Stable Diffusion WebUI (AUTOMATIC1111)
 * - Forge
 * - Forge Neo
 * - Civitai
 * - Animagine
 *
 * Format:
 * ```
 * positive prompt
 * Negative prompt: negative prompt
 * Steps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7, ...
 * ```
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseA1111(entries: MetadataEntry[]): InternalParseResult {
  // Find parameters entry (PNG uses 'parameters', JPEG/WebP uses 'Comment')
  const parametersEntry = entries.find(
    (e) => e.keyword === 'parameters' || e.keyword === 'Comment',
  );
  if (!parametersEntry) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  const text = parametersEntry.text;

  // Parse the text into sections
  const { prompt, negativePrompt, settings } = parseParametersText(text);

  // Parse settings key-value pairs
  const settingsMap = parseSettings(settings);

  // Extract dimensions (optional, defaults to "0x0" like SD Prompt Reader)
  const size = settingsMap.get('Size') ?? '0x0';
  const [width, height] = parseSize(size);

  // Determine software variant
  const version = settingsMap.get('Version');
  const app = settingsMap.get('App');
  const software = detectSoftwareVariant(version, app);

  // Build metadata
  const metadata: Omit<A1111Metadata, 'raw'> = {
    type: 'a1111',
    software,
    prompt,
    negativePrompt,
    width,
    height,
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
  const cfg = parseNumber(
    settingsMap.get('CFG scale') ?? settingsMap.get('CFG Scale'),
  );
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
  const upscaler = settingsMap.get('Hires upscaler');
  const hiresSteps = parseNumber(settingsMap.get('Hires steps'));
  const denoise = parseNumber(settingsMap.get('Denoising strength'));
  const hiresSize = settingsMap.get('Hires size');

  if (
    [hiresScale, hiresSize, upscaler, hiresSteps, denoise].some(
      (v) => v !== undefined,
    )
  ) {
    const [hiresWidth] = parseSize(hiresSize ?? '');
    const scale = hiresScale ?? hiresWidth / width;
    metadata.hires = { scale, upscaler, steps: hiresSteps, denoise };
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
    const key = (match[1] ?? '').trim();
    const value = (match[2] ?? '').trim();
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
  return [
    Number.parseInt(match[1] ?? '0', 10),
    Number.parseInt(match[2] ?? '0', 10),
  ];
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
 * Detect software variant from Version and App strings
 */
function detectSoftwareVariant(
  version: string | undefined,
  app: string | undefined,
): 'sd-webui' | 'sd-next' | 'forge' | 'forge-neo' {
  // Check App field first (SD.Next uses this)
  if (app === 'SD.Next') return 'sd-next';

  // Check Version field
  if (!version) return 'sd-webui';
  if (version === 'neo') return 'forge-neo';
  // Forge uses 'classic' or 'fX.Y.Z' versions (semantic version format)
  if (version === 'classic') return 'forge';
  if (/^f\d+\.\d+/.test(version)) return 'forge';
  return 'sd-webui';
}
