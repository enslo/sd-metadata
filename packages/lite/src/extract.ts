/**
 * Unified detection, parsing, and A1111 text building engine.
 *
 * Architecture (two-stage pipeline):
 *
 *   normalize(entries)  — Pure channeling function. Identifies WHERE the
 *                         generation data lives and routes it into a uniform
 *                         `entries.parameters` field. Never parses content.
 *
 *   extract(entries)    — Reads `entries.parameters` (and other fields),
 *                         detects the originating tool, extracts metadata,
 *                         and builds A1111-format output text.
 *
 * Supported tools:
 *   A1111 / Forge / reForge, NovelAI, ComfyUI, SwarmUI, InvokeAI,
 *   Civitai, TensorArt, Fooocus, RuinedFooocus, EasyDiffusion, HF Space
 */

import type { Entries } from './read';

type JsonObject = Record<string, unknown>;

/**
 * Internal parameter bag for generation metadata.
 *
 * Property names are kept to 1-2 characters because esbuild does not
 * mangle object properties — shorter keys keep the IIFE bundle small.
 * Hover over each field for its full description via JSDoc.
 */
interface GenerationParams {
  /** Positive prompt text */
  p?: string;
  /** Negative prompt text */
  n?: string;
  /** Random seed */
  se?: number;
  /** Sampling steps */
  st?: number;
  /** CFG scale (classifier-free guidance) */
  cf?: number;
  /** Sampler algorithm name */
  sa?: string;
  /** Noise scheduler */
  sc?: string;
  /** Image width in pixels */
  w?: number;
  /** Image height in pixels */
  h?: number;
  /** Model filename */
  md?: string;
  /** Model hash */
  mh?: string;
  /** CLIP skip */
  cs?: number;
  /** Denoising strength */
  dn?: number;
  /** Hires upscale factor */
  hs?: number;
  /** Hires upscaler name */
  hu?: string;
  /** Hires denoising strength */
  hd?: number;
  /** Hires sampling steps */
  ht?: number;
}

// ComfyUI node-graph key. Extracted as a constant so the string literal
// appears only once in the minified IIFE (used in both extract and flatScan).
const CT = 'class_type';

// Extracted as a constant so the 10-character string literal appears only
// once in the minified IIFE (used 13× across normalize, channelKnownKeys,
// and extract).
const PARAMS = 'parameters';

// EasyDiffusion stores metadata as flat PNG tEXt entries keyed by this name.
// Extracted as a constant because the 27-character string appears in three
// places: detection (tryJsonTool, extract) and extraction (extractCommon).
const EASY_DIFF_KEY = 'use_stable_diffusion_model';

// ============================================================================
// Normalize — Pure Channeling (no parsing, no mutation)
// ============================================================================

/**
 * Channel tool-specific entry keys into `entries.parameters`.
 *
 * Each key string appears exactly once in this loop to minimize IIFE size
 * (esbuild cannot mangle object property names).
 *
 * Matched keys and their tools:
 *   - "extraMetadata"     → Civitai (JPEG UserComment JSON)
 *   - "invokeai_metadata" → InvokeAI (PNG tEXt / JPEG UserComment JSON)
 *   - "generation_data"   → TensorArt (JPEG UserComment JSON)
 *
 * Returns a NEW Entries with the matched value routed to `parameters`.
 * If no key matches, returns the original `entries` reference unchanged
 * (enables identity check with `!==`).
 */
function channelKnownKeys(
  src: Record<string, unknown>,
  entries: Entries,
): Entries {
  for (const key of ['extraMetadata', 'invokeai_metadata', 'generation_data']) {
    if (src[key]) {
      const result: Entries = {
        ...entries,
        // PNG tEXt chunks can have trailing null bytes — strip them.
        [PARAMS]:
          entries[PARAMS] ?? stringifyValue(src[key]).replace(/\0+$/, ''),
      };
      // TensorArt stores ComfyUI workflow JSON in a separate "prompt" key.
      // Preserve it so extract() can merge ComfyUI nodes with TensorArt metadata.
      if (src.prompt) result.prompt ??= stringifyValue(src.prompt);
      return result;
    }
  }
  return entries;
}

/**
 * Normalize heterogeneous entry formats into a uniform shape.
 *
 * Pure function — returns a new Entries without mutating the input.
 * Only identifies WHERE data lives and channels it to `entries.parameters`.
 * All actual parsing/extraction is deferred to extract().
 *
 * Entry points by image format:
 *   PNG  → entries already has named keys (parameters, prompt, Comment, etc.)
 *   JPEG → metadata is in EXIF UserComment (plain text or JSON blob)
 *   WebP → same as JPEG (EXIF-based)
 */
function normalize(entries: Entries): Entries {
  // NovelAI (PNG/WebP): metadata is in the Comment field.
  // When Software starts with "NovelAI", Comment is always present.
  if (entries.Software?.startsWith('NovelAI'))
    return { ...entries, [PARAMS]: entries[PARAMS] ?? entries.Comment! };

  // All remaining JPEG/WebP paths go through UserComment.
  const uc = entries.UserComment;

  // No UserComment: check top-level entries for tool-specific keys.
  // This handles PNG images from InvokeAI, Civitai, TensorArt where
  // the data is stored in named PNG tEXt chunks.
  if (!uc) return channelKnownKeys(entries, entries);

  // Plain-text UserComment (not JSON).
  if (!uc.startsWith('{')) {
    // A1111 / Forge / reForge (JPEG): UserComment contains A1111-format
    // text with "Steps:" marker. Channel it directly to parameters.
    if (uc.includes('Steps:'))
      return { ...entries, [PARAMS]: entries[PARAMS] ?? uc };
    // Unknown plain text — return unchanged.
    return entries;
  }

  // JSON UserComment — parse the envelope to inspect keys.
  const obj = parseJson(uc);
  if (!obj) return entries;

  // Check for tool-specific keys inside the JSON envelope.
  // Civitai, InvokeAI, TensorArt (JPEG) embed their data as nested JSON.
  const channeled = channelKnownKeys(obj, entries);
  if (channeled !== entries) return channeled;

  // ComfyUI (JPEG): UserComment has both "prompt" (node graph) and
  // "workflow" keys. Extract the prompt for flatScan in extract().
  if ('prompt' in obj && 'workflow' in obj)
    return { ...entries, prompt: entries.prompt ?? stringifyValue(obj.prompt) };

  // A1111 / Forge (JPEG variant): some tools wrap A1111-format text
  // inside a JSON object with a "parameters" key.
  if (PARAMS in obj)
    return {
      ...entries,
      [PARAMS]: entries[PARAMS] ?? stringifyValue(obj[PARAMS]),
    };

  // Unknown JSON structure — treat the entire UserComment as parameters
  // so extract() can attempt tool detection on it.
  return { ...entries, [PARAMS]: entries[PARAMS] ?? uc };
}

// ============================================================================
// Extract — Detection, Extraction, and A1111 Text Building
// ============================================================================

/**
 * Main entry point: detect the originating tool, extract metadata from
 * normalized entries, and return human-readable A1111-format text.
 */
export function extract(rawEntries: Entries): string {
  const entries = normalize(rawEntries);
  const params = entries[PARAMS];
  // Hoisted: used in both the JSON block and the ComfyUI-only fallback below.
  const prompt = entries.prompt ?? entries.Prompt;

  // --- SwarmUI ---------------------------------------------------------
  // SwarmUI wraps its metadata in a "sui_image_params" key.
  if (params?.includes('sui_image_params')) {
    const obj = parseJson(params)!;
    return buildA1111(
      extractCommon((obj.sui_image_params ?? obj) as JsonObject),
    );
  }

  // --- Plain text (A1111 / Forge / reForge) ----------------------------
  // Already in A1111 format — return as-is.
  if (params && !params.startsWith('{')) return params;

  // --- JSON parameters -------------------------------------------------
  if (params) {
    // First parse: Civitai's extraMetadata can be double-encoded
    // (JSON string containing another JSON string), so we check if
    // the parsed result is itself a string and parse again.
    const raw = parseJson(params) as unknown;
    const obj = (
      typeof raw === 'string' ? parseJson(raw) : raw
    ) as JsonObject | null;
    if (obj) {
      // Try specific tool detectors (RuinedFooocus, EasyDiffusion,
      // Fooocus, HF Space, NovelAI).
      const result = tryJsonTool(obj, params);
      if (result) return result;

      // ComfyUI (PNG): node graph stored directly in parameters.
      if (params.includes(CT)) return buildA1111(flatScan(params));

      // Generic JSON fallback: extract common fields.
      // Handles InvokeAI, Civitai, TensorArt, and other tools that
      // use standard field names (prompt, seed, steps, cfg, etc.).
      const base = extractCommon(obj);

      // TensorArt + ComfyUI hybrid: TensorArt stores generation
      // metadata in generation_data (→ params), but the ComfyUI
      // node graph is in a separate prompt field. Merge them:
      // flatScan provides seed/steps/cfg/sampler from ComfyUI nodes,
      // base provides prompt/negative/model/hash from TensorArt.
      if (prompt?.includes(CT))
        return buildA1111({
          ...flatScan(prompt),
          p: base.p,
          n: base.n,
          md: base.md,
          mh: base.mh,
        });

      return buildA1111(base);
    }
  }

  // --- EasyDiffusion (PNG, non-JSON parameters) ------------------------
  // EasyDiffusion stores fields as top-level PNG tEXt entries
  // with a distinctive "use_stable_diffusion_model" key.
  if (entries[EASY_DIFF_KEY]) return buildA1111(extractCommon(entries));

  // --- ComfyUI (PNG, no parameters field) ------------------------------
  // Some ComfyUI outputs only have a "prompt" PNG tEXt chunk
  // containing the node graph (no "parameters" chunk).
  if (prompt?.includes(CT)) return buildA1111(flatScan(prompt));

  // --- Final fallback --------------------------------------------------
  // Return whatever text is available, trying the most likely fields first.
  return (
    params ??
    entries.UserComment ??
    entries.Comment ??
    entries.ImageDescription ??
    ''
  );
}

// ============================================================================
// JSON Tool Detector
// ============================================================================

/**
 * Attempt to identify specific tools from a parsed JSON object.
 * Returns A1111-format text if a tool is recognized, null otherwise.
 *
 * Detection is ordered from most specific to least specific signatures.
 */
function tryJsonTool(obj: JsonObject, text: string): string | null {
  // RuinedFooocus: identified by "software" field containing "RuinedFooocus".
  if (asString(obj.software).includes('RuinedFooocus'))
    return buildA1111(extractCommon(obj));

  // EasyDiffusion (JSON variant): identified by "use_stable_diffusion_model".
  if (EASY_DIFF_KEY in obj) return buildA1111(extractCommon(obj));

  // Fooocus: identified by having both "Model" (capital M) and "resolution"
  // keys. Resolution format: "1024x1024". Also has optional upscaler data.
  if (text.includes('"Model"') && text.includes('"resolution"')) {
    const [w, h] = parseDimensions(
      asString(obj.resolution),
      /(\d+)\s*x\s*(\d+)/,
    );
    return buildA1111({ ...extractCommon(obj), w, h });
  }

  // HF Space / Civitai generator: identified by "base_model" key.
  // Resolution format: "(1024, 1024)" (Python tuple string).
  if ('base_model' in obj) {
    const [w, h] = parseDimensions(
      asString(obj.resolution),
      /\(\s*(\d+)\s*,\s*(\d+)\s*\)/,
    );
    return buildA1111({ ...extractCommon(obj), w, h });
  }

  // NovelAI (PNG/WebP JSON): identified by "noise_schedule" key.
  // Has special v4 prompt format that needs dedicated handling.
  if ('noise_schedule' in obj) return buildNovelAI(obj);

  return null;
}

// ============================================================================
// Common JSON Extractor
// ============================================================================

/**
 * Extract GenerationParams from a JSON object using field name fallback chains.
 *
 * Each field tries multiple property names to cover all known JSON-based tools.
 * The fallback order generally goes: most common name → tool-specific aliases.
 *
 * Covered tools: A1111, NovelAI, SwarmUI, InvokeAI, Civitai, TensorArt,
 * Fooocus, RuinedFooocus, EasyDiffusion, HF Space.
 */
function extractCommon(obj: Record<string, unknown>): GenerationParams {
  const sa = asString(obj.sampler ?? obj.sampler_name);
  const sc = asString(obj.scheduler ?? obj.noise_schedule);
  const mod = obj.model as JsonObject | undefined;
  const base = obj.baseModel as JsonObject | undefined;
  const up = obj.use_upscaler as JsonObject | undefined;
  return {
    // Prompt: "prompt" (most tools) → "Prompt" (Fooocus) → "positive_prompt" (RuinedFooocus)
    p: asString(obj.prompt ?? obj.Prompt ?? obj.positive_prompt),
    // Negative: multiple naming conventions across tools
    // "uc" = NovelAI's "undesired content"
    n: asString(
      obj.negative_prompt ??
        obj.Negative ??
        obj.negativeprompt ??
        obj.negativePrompt ??
        obj.uc,
    ),
    se: asNumber(obj.seed),
    // "num_inference_steps" = HF Space / Civitai generator
    st: asNumber(obj.steps ?? obj.num_inference_steps),
    // CFG: many naming variants across tools
    // "scale" = NovelAI, "guidance_scale" = HF Space
    cf: asNumber(
      obj.cfg ??
        obj.cfg_scale ??
        obj.cfgScale ??
        obj.cfgscale ??
        obj.guidance_scale ??
        obj.scale,
    ),
    // InvokeAI quirk: stores the sampler name in the "scheduler" field
    // and has no separate sampler field. If sa is empty, use sc as sa.
    sa: sa || sc,
    sc: sa ? sc : undefined,
    w: asNumber(obj.width),
    h: asNumber(obj.height),
    // Model name: extensive fallback chain covering all known patterns.
    // "model" (string)          → InvokeAI, SwarmUI, Civitai
    // "Model" (capital)         → Fooocus
    // "base_model"              → HF Space
    // "base_model_name"         → Civitai generator
    // "baseModel" (string)      → TensorArt (when stored as string)
    // "model.name"              → Civitai (nested object)
    // "baseModel.modelFileName" → TensorArt (nested object)
    // "use_stable_diffusion_model" → EasyDiffusion (full path, take filename)
    md:
      asString(mod) ||
      asString(obj.Model) ||
      asString(obj.base_model) ||
      asString(obj.base_model_name) ||
      asString(base) ||
      asString(mod?.name) ||
      asString(base?.modelFileName) ||
      asString(obj[EASY_DIFF_KEY]).split(/[\\/]/).pop(),
    // Model hash: similar multi-tool fallback chain.
    // "Model hash"    → Fooocus
    // "model.hash"    → Civitai (nested)
    // "baseModel.hash" → TensorArt (nested)
    mh:
      asString(obj.base_model_hash) ||
      asString(obj['Model hash']) ||
      asString(mod?.hash) ||
      asString(base?.hash),
    cs: asNumber(obj.clip_skip ?? obj.clipSkip),
    // Hires/upscaler: use_upscaler (Fooocus, HF Space) → refiner* (SwarmUI)
    hs: asNumber(up?.upscale_by) ?? asNumber(obj.refinerupscale),
    hu: asString(up?.upscale_method) || asString(obj.refinerupscalemethod),
    hd:
      asNumber(up?.upscaler_strength) ?? asNumber(obj.refinercontrolpercentage),
    ht: asNumber(up?.upscale_steps),
  };
}

// ============================================================================
// Tool-Specific Builders
// ============================================================================

/**
 * Build A1111 text from NovelAI JSON metadata.
 *
 * NovelAI v4+ uses a nested prompt structure:
 *   { v4_prompt: { caption: { base_caption: "..." } } }
 * Falls back to flat "prompt" / "uc" fields for older versions.
 */
function buildNovelAI(obj: JsonObject): string {
  const v4Caption = (obj.v4_prompt as JsonObject)?.caption as
    | JsonObject
    | undefined;
  const v4NegCaption = (obj.v4_negative_prompt as JsonObject)?.caption as
    | JsonObject
    | undefined;
  return buildA1111({
    ...extractCommon(obj),
    // Prefer v4 captions, fall back to legacy flat fields.
    p: asString(v4Caption?.base_caption) || asString(obj.prompt),
    n: asString(v4NegCaption?.base_caption) || asString(obj.uc),
  });
}

// ============================================================================
// ComfyUI Flat Scanner
// ============================================================================

/**
 * Scan a ComfyUI node graph (flat JSON) and extract generation parameters.
 *
 * ComfyUI stores metadata as a dictionary of nodes, each with a "class_type"
 * and "inputs" object. This function iterates all nodes and extracts
 * relevant parameters based on the node's class type.
 *
 * The "first match wins" strategy (??= / ||=) ensures we pick the primary
 * node when multiple nodes of the same type exist (e.g. two KSamplers).
 */
function flatScan(json: string): GenerationParams {
  const result: GenerationParams = {};
  // Pre-clean: strip trailing null bytes (PNG chunks) and replace NaN
  // literals that some ComfyUI versions emit (invalid JSON).
  const nodes = parseJson(json.replace(/\0+$/, '').replace(/\bNaN\b/g, 'null'));
  if (!nodes) return result;

  for (const key in nodes) {
    const node = nodes[key] as JsonObject;
    if (!node || typeof node !== 'object') continue;
    const classType = asString(node[CT]);
    const inputs = node.inputs as JsonObject | undefined;
    if (!inputs) continue;

    // --- Prompt text nodes -------------------------------------------
    // Matches CLIPTextEncode (and variants like SDXL, Flux) via "TextEncode",
    // and text box nodes (DF_Text_Box, TextBox) via ".?Box".
    // Unified classification: if class name contains "neg" → negative prompt,
    // otherwise first-come-first-served (1st → positive, 2nd → negative).
    if (/Text(Encode|.?Box)/.test(classType)) {
      const txt =
        asString(inputs.text) ||
        asString(inputs.prompt) ||
        asString(inputs.Text);
      if (txt) {
        if (/neg/i.test(classType)) {
          result.n ??= txt;
        } else {
          if (!result.p) result.p = txt;
          else if (!result.n) result.n = txt;
        }
      }
    }

    // --- Sampler nodes (KSampler, KSamplerAdvanced, etc.) ------------
    // Class-type guard is required here: "steps" and "seed" also appear
    // on non-sampler nodes (BasicScheduler, RandomNoise, etc.).
    if (classType.includes('Sampler')) {
      result.se ??= asNumber(inputs.seed) ?? asNumber(inputs.noise_seed);
      result.st ??= asNumber(inputs.steps);
      result.cf ??= asNumber(inputs.cfg);
      result.sa ||= asString(inputs.sampler_name);
      result.sc ||= asString(inputs.scheduler);
    }

    // --- Model loader nodes ------------------------------------------
    // ckpt_name / unet_name are unique to checkpoint and UNET loaders —
    // no class_type guard needed; unconditional ||= is safe here.
    result.md ||= asString(inputs.ckpt_name) || asString(inputs.unet_name);

    // --- Latent image nodes (for dimensions) -------------------------
    result.w ??= asNumber(inputs.width);
    result.h ??= asNumber(inputs.height);
  }
  return result;
}

// ============================================================================
// A1111 Text Builder
// ============================================================================

/**
 * Build human-readable text in A1111 (Stable Diffusion WebUI) format.
 *
 * Output structure:
 *   Line 1: positive prompt
 *   Line 2: "Negative prompt: <negative prompt>"
 *   Line 3: comma-separated key-value pairs (Steps, Sampler, CFG, etc.)
 */
function buildA1111(params: GenerationParams): string {
  const lines: string[] = [];
  if (params.p) lines.push(params.p);
  if (params.n) lines.push(`Negative prompt: ${params.n}`);

  const fields: string[] = [];
  // addField only appends when value is truthy (skips 0, undefined, "").
  const addField = (key: string, value: string | number | undefined) => {
    if (value) fields.push(`${key}: ${value}`);
  };

  addField('Steps', params.st);
  addField('Sampler', params.sa);
  addField('Schedule type', params.sc);
  addField('CFG scale', params.cf);
  addField('Seed', params.se);
  if (params.w && params.h) addField('Size', `${params.w}x${params.h}`);
  addField('Model hash', params.mh);
  addField('Model', params.md);
  addField('Clip skip', params.cs);
  // Denoising strength: dn (standard) or hd (Fooocus refiner percentage).
  addField('Denoising strength', params.dn ?? params.hd);
  addField('Hires upscale', params.hs);
  addField('Hires steps', params.ht);
  addField('Hires upscaler', params.hu);

  if (fields.length) lines.push(fields.join(', '));
  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

/** Safely parse JSON, returning null on failure. */
function parseJson(text: string | undefined): JsonObject | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as JsonObject;
  } catch {
    return null;
  }
}

/**
 * Coerce unknown value to string. Returns "" for non-strings.
 * Returning "" (falsy) enables `||` fallback chains: `asString(a) || asString(b)`.
 */
function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Convert a value to its string representation for channeling.
 * Strings pass through unchanged; objects are JSON-serialized.
 * Used by channelKnownKeys to convert nested JSON objects to strings
 * that extract() can later re-parse.
 */
function stringifyValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return JSON.stringify(v);
  return '';
}

/**
 * Coerce unknown value to number. Returns undefined for non-numeric values.
 * Accepts both number and numeric string inputs (e.g. "42" → 42).
 * NaN values are filtered out and returned as undefined.
 */
function asNumber(v: unknown): number | undefined {
  // biome-ignore lint/suspicious/noSelfCompare: intentional NaN check (IEEE 754: NaN !== NaN)
  if (typeof v === 'number') return v === v ? v : undefined;
  if (typeof v === 'string') {
    const n = +v;
    // biome-ignore lint/suspicious/noSelfCompare: intentional NaN check (IEEE 754: NaN !== NaN)
    return n === n ? n : undefined;
  }
  return undefined;
}

/**
 * Extract width/height from a dimension string using the given regex.
 * Different tools use different formats:
 *   - Fooocus:  "1024x1024"       → /(\d+)\s*x\s*(\d+)/
 *   - HF Space: "(1024, 1024)"    → /\(\s*(\d+)\s*,\s*(\d+)\s*\)/
 */
function parseDimensions(
  text: string | undefined,
  pattern: RegExp,
): [number?, number?] {
  if (!text) return [];
  const match = text.match(pattern);
  return match ? [Number(match[1]), Number(match[2])] : [];
}
