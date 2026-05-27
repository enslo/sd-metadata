/**
 * ComfyUI flat node scanner (fallback)
 *
 * Iterates every node in the graph and extracts generation parameters via
 * pattern matching on class_type and direct input values. Used as a fallback
 * when the structured parser (extractComfyUIMetadata) cannot resolve fields
 * through sampler-rooted graph traversal — typically because of custom nodes
 * or non-standard workflow topology.
 *
 * Strategy (ported from packages/lite/src/extract.ts flatScan):
 *
 *   Text nodes (CLIPTextEncode, *TextBox, etc.) — matched by /Text(Encode|.?Box)/
 *     - class_type contains "neg" (case-insensitive) → negative prompt
 *     - otherwise: first match → positive, second match → negative
 *
 *   Sampler nodes — class_type contains "Sampler"
 *     - seed: inputs.seed or inputs.noise_seed (numeric literals only)
 *     - steps, cfg, sampler_name, scheduler: direct numeric/string literals
 *
 *   Model loaders — any node exposing ckpt_name or unet_name
 *
 *   Dimensions — any node exposing numeric width/height
 *
 * First-match-wins for every field. The caller is responsible for merging
 * this result with higher-priority sources (structured parser, CivitAI
 * extraMetadata) and only using it to fill genuinely empty fields.
 *
 * Node references ([nodeId, outputIndex] arrays) are intentionally NOT
 * followed — flat scan only consumes direct literal values, mirroring the
 * lite parser's behaviour.
 */

import type { ComfyNodeGraph, SamplingSettings } from '../types';
import type { PartialMetadata } from './types';

// =============================================================================
// Class type matchers
// =============================================================================

/**
 * Matches text-bearing node classes:
 *   - CLIPTextEncode and its variants (SDXL, Flux, SD3, etc.)
 *   - Text box nodes (DF_Text_Box, TextBox, CR Text Box, etc.)
 *   - ShowText|pysssss (pythongosssss/ComfyUI-Custom-Scripts), a popular
 *     display/cache node that stores final composed prompts in inputs.text_0
 *   - PromptStashSaver (community node) which holds user-authored prompts in
 *     inputs.prompt_text
 */
const TEXT_NODE_PATTERN = /Text(Encode|.?Box)|ShowText|PromptStash/;

/** Case-insensitive hint that a text node represents negative conditioning */
const NEGATIVE_HINT_PATTERN = /neg/i;

// =============================================================================
// Coercion helpers
// =============================================================================

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// =============================================================================
// Main scanner
// =============================================================================

/**
 * Scan a ComfyUI node graph and extract generation parameters via brute force.
 *
 * Pure function: never mutates the input. Returns only fields that were
 * successfully extracted; missing fields are omitted entirely.
 *
 * @param nodes - Parsed ComfyUI node graph
 * @returns Partial metadata extracted by flat scan
 */
export function flatScanComfyMetadata(nodes: ComfyNodeGraph): PartialMetadata {
  let prompt: string | undefined;
  let negativePrompt: string | undefined;

  let seed: number | undefined;
  let steps: number | undefined;
  let cfg: number | undefined;
  let samplerName: string | undefined;
  let scheduler: string | undefined;

  let modelName: string | undefined;
  let width: number | undefined;
  let height: number | undefined;

  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== 'object') continue;
    const classType = node.class_type;
    const inputs = node.inputs;
    if (!classType || !inputs) continue;

    // --- Prompt text nodes -------------------------------------------------
    if (TEXT_NODE_PATTERN.test(classType)) {
      const txt =
        asString(inputs.text) ||
        asString(inputs.prompt) ||
        asString(inputs.Text) ||
        asString(inputs.prompt_text) ||
        asString(inputs.text_0);
      if (txt) {
        if (NEGATIVE_HINT_PATTERN.test(classType)) {
          if (!negativePrompt) negativePrompt = txt;
        } else if (!prompt) {
          prompt = txt;
        } else if (!negativePrompt) {
          negativePrompt = txt;
        }
      }
    }

    // --- Sampler nodes -----------------------------------------------------
    // "Sampler" class-type guard is necessary because seed/steps/cfg also
    // appear on non-sampler nodes (BasicScheduler, RandomNoise, etc.).
    if (classType.includes('Sampler')) {
      if (seed === undefined) {
        seed = asNumber(inputs.seed) ?? asNumber(inputs.noise_seed);
      }
      if (steps === undefined) steps = asNumber(inputs.steps);
      if (cfg === undefined) cfg = asNumber(inputs.cfg);
      if (!samplerName) samplerName = asString(inputs.sampler_name);
      if (!scheduler) scheduler = asString(inputs.scheduler);
    }

    // --- Model loaders -----------------------------------------------------
    // ckpt_name / unet_name are unique to checkpoint and UNET loaders, so
    // an unconditional first-match is safe (no class_type guard needed).
    if (!modelName) {
      modelName = asString(inputs.ckpt_name) || asString(inputs.unet_name);
    }

    // --- Latent / image dimensions ----------------------------------------
    if (width === undefined) width = asNumber(inputs.width);
    if (height === undefined) height = asNumber(inputs.height);
  }

  const sampling: SamplingSettings = {};
  if (seed !== undefined) sampling.seed = seed;
  if (steps !== undefined) sampling.steps = steps;
  if (cfg !== undefined) sampling.cfg = cfg;
  if (samplerName) sampling.sampler = samplerName;
  if (scheduler) sampling.scheduler = scheduler;

  const result: PartialMetadata = {};
  if (prompt) result.prompt = prompt;
  if (negativePrompt) result.negativePrompt = negativePrompt;
  if (width !== undefined && width > 0) result.width = width;
  if (height !== undefined && height > 0) result.height = height;
  if (modelName) result.model = { name: modelName };
  if (Object.keys(sampling).length > 0) result.sampling = sampling;
  return result;
}
