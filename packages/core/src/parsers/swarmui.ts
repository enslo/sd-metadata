import type { ComfyNodeGraph, LoraSettings } from '../types';
import { Result } from '../types';
import type { EntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';
import { lora, optionalLoras, toWeight } from '../utils/lora';
import { trimObject } from '../utils/object';
import { toSeedString } from '../utils/seed';
import type { InternalParseResult } from './types';

/**
 * SwarmUI parameters JSON structure
 */
interface SwarmUIParameters {
  sui_image_params?: {
    prompt?: string;
    negativeprompt?: string;
    model?: string;
    seed?: number | string;
    steps?: number;
    cfgscale?: number;
    width?: number;
    height?: number;
    sampler?: string;
    scheduler?: string;
    // Refiner/Upscale settings
    refinerupscale?: number;
    refinerupscalemethod?: string;
    refinercontrolpercentage?: number;
    /** LoRA names as selected in the UI: file stem, folder prefix kept */
    loras?: unknown[];
    /** One weight per LoRA, written as text ("0.6") */
    loraweights?: unknown[];
  };
  /** Model files that took part, each with the parameter it was used for and its hash */
  sui_models?: Array<{ name?: unknown; param?: unknown; hash?: unknown }>;
}

/**
 * Extract SwarmUI parameters from entry record
 *
 * Checks direct 'parameters' entry first, then tries to extract from Comment JSON.
 * After converter fix, Comment JSON contains direct sui_image_params (native WebP format).
 */
function extractSwarmUIParameters(
  entryRecord: Record<string, string | undefined>,
): string | undefined {
  // Direct parameters entry (PNG format)
  if (entryRecord.parameters) {
    return entryRecord.parameters;
  }

  // Try to extract from UserComment JSON (JPEG/WebP format)
  if (!entryRecord.UserComment) {
    return undefined;
  }

  const commentParsed = parseJson(entryRecord.UserComment);
  if (!commentParsed.ok || commentParsed.type !== 'object') {
    return undefined;
  }

  // Native WebP format: direct sui_image_params
  if ('sui_image_params' in commentParsed.value) {
    return entryRecord.UserComment; // Return as-is to preserve full structure
  }

  return undefined;
}

/**
 * Read the LoRA list of `sui_image_params`
 *
 * `loras[i]` and `loraweights[i]` are parallel lists. `sui_models` lists the
 * same files with their extension and sha256 hash under `param: "loras"`, so
 * the hash is matched by file name without the extension. Names stay as
 * SwarmUI wrote them.
 *
 * @param params - `sui_image_params` object
 * @param models - `sui_models` list, if present
 * @returns LoRAs in UI order
 */
function extractLoras(
  params: NonNullable<SwarmUIParameters['sui_image_params']>,
  models: SwarmUIParameters['sui_models'],
): LoraSettings[] {
  if (!Array.isArray(params.loras)) return [];
  const weights = Array.isArray(params.loraweights) ? params.loraweights : [];

  const hashes = new Map<string, string>();
  for (const model of models ?? []) {
    if (model.param !== 'loras') continue;
    if (typeof model.name !== 'string' || typeof model.hash !== 'string') {
      continue;
    }
    hashes.set(stripExtension(model.name), model.hash);
  }

  return params.loras.flatMap((name, i) =>
    typeof name === 'string' && name !== ''
      ? [lora({ name, weight: toWeight(weights[i]), hash: hashes.get(name) })]
      : [],
  );
}

/**
 * Remove the file extension (`LECO_BadHands.safetensors` → `LECO_BadHands`)
 */
function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]*$/, '');
}

/**
 * Parse SwarmUI metadata from entries
 *
 * SwarmUI stores metadata with:
 * - parameters: JSON containing sui_image_params
 * - prompt: ComfyUI-style node graph (fallback)
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseSwarmUI(entries: EntryRecord): InternalParseResult {
  // Find parameters entry
  // For PNG: direct keyword 'parameters'
  // For JPEG/WebP: inside Comment JSON
  const parametersText = extractSwarmUIParameters(entries);

  if (!parametersText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse parameters JSON
  const parsed = parseJson<SwarmUIParameters>(parametersText);
  if (!parsed.ok || parsed.type !== 'object') {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in parameters entry',
    });
  }

  // Verify SwarmUI format (has sui_image_params)
  const params = parsed.value.sui_image_params;
  if (!params) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Extract dimensions (fallback to 0 for IHDR extraction)
  const width = params.width ?? 0;
  const height = params.height ?? 0;

  // Parse nodes from prompt chunk (PNG format) or Make field (JPEG/WebP extended format)
  const promptSource = entries.prompt || entries.Make;
  const promptParsed = promptSource
    ? parseJson<ComfyNodeGraph>(promptSource)
    : undefined;
  const nodes =
    promptParsed?.ok && promptParsed.type === 'object'
      ? promptParsed.value
      : undefined;

  const loras = extractLoras(params, parsed.value.sui_models);

  return Result.ok({
    software: 'swarmui',
    prompt: params.prompt ?? '',
    negativePrompt: params.negativeprompt ?? '',
    width,
    height,
    nodes,
    model: trimObject({ name: params.model }),
    sampling: trimObject({
      seed: toSeedString(params.seed),
      steps: params.steps,
      cfg: params.cfgscale,
      sampler: params.sampler,
      scheduler: params.scheduler,
    }),
    hires: trimObject({
      scale: params.refinerupscale,
      upscaler: params.refinerupscalemethod,
      denoise: params.refinercontrolpercentage,
    }),
    ...optionalLoras(loras),
  });
}
