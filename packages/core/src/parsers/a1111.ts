import type { GenerationSoftware, LoraSettings } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import {
  lora,
  parseLoraTags,
  parseNameValueList,
  withLoraHashes,
} from '../utils/lora';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import type { InternalParseResult } from './types';

/** Software identifiers that use A1111-compatible text format */
type A1111Software = Extract<
  GenerationSoftware,
  | 'sd-webui'
  | 'sd-next'
  | 'forge'
  | 'forge-classic'
  | 'forge-neo'
  | 'reforge'
  | 'easy-reforge'
  | 'civitai'
  | 'fooocus'
>;

/**
 * Parse A1111-format metadata from entries
 *
 * A1111 format is used by:
 * - Stable Diffusion WebUI (AUTOMATIC1111)
 * - Forge family (Forge, Forge Classic, Forge Neo, reForge, EasyReforge)
 * - SD.Next
 * - Civitai (A1111 text fallback)
 * - Fooocus (a1111 metadata scheme)
 * - ComfyUI save nodes that write A1111-style text (detected as sd-webui)
 *
 * Format:
 * ```
 * positive prompt
 * Negative prompt: negative prompt
 * Steps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7, ...
 * ```
 *
 * LoRAs are read from the `<lora:…>` tags of the positive prompt (with
 * hashes from `Lora hashes`), or, for tools that write no tags, from
 * Fooocus's `Lora weights`, SaveImageWithMetaData's `Lora_N …` keys or
 * CivitAI's `Civitai resources` list.
 *
 * @param entries - Metadata entries
 * @param software - Pre-detected software identifier from detectSoftware()
 * @returns Parsed metadata or error
 */
export function parseA1111(
  entries: EntryRecord,
  software: A1111Software,
): InternalParseResult {
  // Find parameters entry (PNG uses 'parameters', JPEG/WebP uses 'UserComment')
  const text = entries.parameters ?? entries.UserComment;
  if (!text) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse the text into sections
  const { prompt, negativePrompt, settings } = parseParametersText(text);

  // Parse settings key-value pairs
  const settingsMap = parseSettings(settings);

  // Extract dimensions (optional, defaults to "0x0" like SD Prompt Reader)
  const size = settingsMap.get('Size') ?? '0x0';
  const [width, height] = parseSize(size);

  // Extract model settings
  const modelName = settingsMap.get('Model');
  const modelHash = settingsMap.get('Model hash');

  // Extract sampling settings
  const sampler = settingsMap.get('Sampler');
  const scheduler = settingsMap.get('Schedule type');
  const steps = parseNumber(settingsMap.get('Steps'));
  const cfg = parseNumber(
    settingsMap.get('CFG scale') ?? settingsMap.get('CFG Scale'),
  );
  const seed = toSeedString(settingsMap.get('Seed'));
  const clipSkip = parseNumber(settingsMap.get('Clip skip'));

  // Extract hires settings
  const hiresScale = parseNumber(settingsMap.get('Hires upscale'));
  const upscaler = settingsMap.get('Hires upscaler');
  const hiresSteps = parseNumber(settingsMap.get('Hires steps'));
  const denoise = parseNumber(settingsMap.get('Denoising strength'));
  const hiresSize = settingsMap.get('Hires size');
  const [hiresWidth] = parseSize(hiresSize ?? '');
  const scale = hiresScale ?? (hiresWidth > 0 ? hiresWidth / width : undefined);

  const loras = extractLoras(prompt, settingsMap);

  return Result.ok({
    software,
    prompt,
    negativePrompt,
    width,
    height,
    model: trimObject({ name: modelName, hash: modelHash }),
    sampling: trimObject({
      sampler,
      scheduler,
      steps,
      cfg,
      seed,
      clipSkip,
    }),
    hires: trimObject({ scale, upscaler, steps: hiresSteps, denoise }),
    ...(loras.length > 0 ? { loras } : {}),
  });
}

// ============================================================================
// LoRA extraction
// ============================================================================

/**
 * Collect the LoRAs of an A1111-style text
 *
 * One source per file, tried in order:
 * 1. `<lora:…>` tags in the positive prompt (sd-webui, Forge family,
 *    SD.Next, Easy reForge), hashes from `Lora hashes`
 * 2. Fooocus a1111 scheme: `Lora weights: "name: w, …"` plus `Lora hashes`
 * 3. ComfyUI-SaveImageWithMetaData: `Lora_N Model name` / `Model hash` /
 *    `Strength model` / `Strength clip`, N counted from 0
 * 4. CivitAI: `Civitai resources: [{type:"lora", modelName, weight}]`
 */
function extractLoras(
  prompt: string,
  settings: Map<string, string>,
): LoraSettings[] {
  const hashes = settings.get('Lora hashes');

  const tagged = parseLoraTags(prompt);
  if (tagged.length > 0) return withLoraHashes(tagged, hashes);

  const weights = parseNameValueList(settings.get('Lora weights'));
  if (weights.length > 0) {
    return withLoraHashes(
      weights.map(([name, weight]) =>
        lora({ name, weight: parseNumber(weight) }),
      ),
      hashes,
    );
  }

  const indexed = extractIndexedLoras(settings);
  if (indexed.length > 0) return indexed;

  return extractCivitaiLoras(settings.get('Civitai resources'));
}

/**
 * LoRAs written as `Lora_N …` keys (ComfyUI-SaveImageWithMetaData)
 */
function extractIndexedLoras(settings: Map<string, string>): LoraSettings[] {
  const loras: LoraSettings[] = [];

  for (let i = 0; ; i++) {
    const name = settings.get(`Lora_${i} Model name`);
    if (!name) break;
    loras.push(
      lora({
        name,
        weight: parseNumber(settings.get(`Lora_${i} Strength model`)),
        clipWeight: parseNumber(settings.get(`Lora_${i} Strength clip`)),
        hash: settings.get(`Lora_${i} Model hash`),
      }),
    );
  }

  return loras;
}

/**
 * LoRAs listed in CivitAI's `Civitai resources` JSON
 *
 * CivitAI's A1111-style text has no tags; each LoRA is an entry with the
 * display name (`modelName`) and its weight. Checkpoints and other types are
 * skipped.
 */
function extractCivitaiLoras(json: string | undefined): LoraSettings[] {
  if (!json) return [];

  const parsed = parseJson(json);
  if (!parsed.ok || parsed.type !== 'array') return [];

  return parsed.value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const resource = entry as Record<string, unknown>;
    if (
      typeof resource.type !== 'string' ||
      resource.type.toLowerCase() !== 'lora' ||
      typeof resource.modelName !== 'string'
    ) {
      return [];
    }
    return [
      lora({
        name: resource.modelName,
        weight:
          typeof resource.weight === 'number' ? resource.weight : undefined,
      }),
    ];
  });
}

// ============================================================================
// Text sections
// ============================================================================

/**
 * Parse parameters text into prompt, negative prompt, and settings
 */
function parseParametersText(text: string): {
  prompt: string;
  negativePrompt: string;
  settings: string;
} {
  const sections = splitSections(text);
  return {
    prompt: stripTemplates(sections.prompt),
    negativePrompt: stripTemplates(sections.negativePrompt),
    settings: sections.settings,
  };
}

/**
 * Split the text at "Negative prompt:" and the settings line
 */
function splitSections(text: string): {
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
 * Drop SD.Next's template echo from a prompt section
 *
 * SD.Next appends "\nTemplate: …" and "\nNegative template: …" (the prompts
 * before style expansion) between the negative prompt and the settings line
 * (modules/processing_info.py), so they land inside the preceding section.
 */
function stripTemplates(text: string): string {
  const match = /(?:^|\n)(?:Template|Negative template): /.exec(text);
  return match ? text.slice(0, match.index).trim() : text;
}

// ============================================================================
// Settings line
// ============================================================================

/** Key as A1111's infotext regex accepts it, followed by the colon */
const SETTINGS_KEY = /\s*([A-Za-z][A-Za-z0-9 _\-/]*?):\s*/y;

/**
 * Parse settings line into key-value map
 *
 * Format: "Key1: value1, Key2: value2, ..."
 *
 * Follows A1111's own reader: a value is either a quoted JSON string
 * (`Lora hashes: "a: 1, b: 2"`, unquoted here), a JSON array or object
 * (`Civitai resources: [...]`, kept as text), or plain text up to the next
 * comma. Text that does not form a `Key:` is skipped.
 */
function parseSettings(settings: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!settings) return result;

  let pos = 0;
  while (pos < settings.length) {
    SETTINGS_KEY.lastIndex = pos;
    const keyMatch = SETTINGS_KEY.exec(settings);
    if (!keyMatch) {
      // Not a key: skip to the next entry
      const next = settings.indexOf(',', pos);
      if (next < 0) break;
      pos = next + 1;
      continue;
    }

    const key = (keyMatch[1] ?? '').trim();
    const [value, end] = readValue(settings, SETTINGS_KEY.lastIndex);
    result.set(key, value);

    const comma = settings.indexOf(',', end);
    if (comma < 0) break;
    pos = comma + 1;
  }

  return result;
}

/**
 * Read one settings value starting at `start`
 *
 * @returns The value and the index just after it
 */
function readValue(text: string, start: number): [string, number] {
  const first = text[start];

  if (first === '"') {
    const end = scanQuoted(text, start);
    return [unquote(text.slice(start, end)), end];
  }

  if (first === '[' || first === '{') {
    const end = scanJson(text, start);
    return [text.slice(start, end), end];
  }

  const comma = text.indexOf(',', start);
  const end = comma < 0 ? text.length : comma;
  return [text.slice(start, end).trim(), end];
}

/**
 * Index just after the closing quote of the string starting at `start`
 */
function scanQuoted(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') {
      i++;
    } else if (char === '"') {
      return i + 1;
    }
  }
  return text.length;
}

/**
 * Index just after the bracket closing the JSON value starting at `start`
 */
function scanJson(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      i = scanQuoted(text, i) - 1;
    } else if (char === '[' || char === '{') {
      depth++;
    } else if (char === ']' || char === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/**
 * Decode a quoted settings value like A1111 does (json.loads, else as-is)
 */
function unquote(raw: string): string {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'string' ? value : raw;
  } catch {
    return raw;
  }
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
