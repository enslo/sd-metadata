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

import { type Entries, parseJson } from './read';

type JsonObject = Record<string, unknown>;

/**
 * Internal parameter bag for generation metadata.
 *
 * Every field is text: the output is A1111-format text and lite never does
 * arithmetic on these values. Text is kept exactly as the tool wrote it,
 * so a 64-bit seed written as a string keeps every digit; one written as a
 * JSON number has already been rounded past 2^53 by JSON.parse, the same
 * limit the core library has. An empty string means "not found".
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
  se?: string;
  /** Sampling steps */
  st?: string;
  /** CFG scale (classifier-free guidance) */
  cf?: string;
  /** Sampler algorithm name */
  sa?: string;
  /** Noise scheduler */
  sc?: string;
  /** Image width in pixels */
  w?: string;
  /** Image height in pixels */
  h?: string;
  /** Model filename */
  md?: string;
  /** Model hash */
  mh?: string;
  /** CLIP skip */
  cs?: string;
  /** Denoising strength */
  dn?: string;
  /** Hires upscale factor */
  hs?: string;
  /** Hires upscaler name */
  hu?: string;
  /** Hires denoising strength */
  hd?: string;
  /** Hires sampling steps */
  ht?: string;
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
// Normalize — Pure Channeling (no parsing)
// ============================================================================

/**
 * Channel tool-specific keys of `src` into `entries.parameters`.
 *
 * Each key string appears exactly once to minimize IIFE size (esbuild cannot
 * mangle object property names).
 *
 * Matched keys and their tools:
 *   - "extraMetadata"     → Civitai (JPEG UserComment JSON)
 *   - "invokeai_metadata" → InvokeAI (PNG tEXt / JPEG UserComment JSON)
 *   - "generation_data"   → TensorArt (JPEG UserComment JSON)
 *
 * Writes into `entries`, which is the copy normalize() works on, and tells
 * whether a key matched. A value that is already there is kept.
 */
function channelKnownKeys(
  src: Record<string, unknown>,
  entries: Entries,
): boolean {
  const key = ['extraMetadata', 'invokeai_metadata', 'generation_data'].find(
    (k) => src[k],
  );
  if (key) {
    // PNG tEXt chunks can have trailing null bytes — strip them. The
    // lookbehind starts the match at the first NUL of the run only, so a
    // byte after the run does not make the regex retry from every NUL.
    entries[PARAMS] ??= stringifyValue(src[key]).replace(/(?<!\0)\0+$/, '');
    // TensorArt stores ComfyUI workflow JSON in a separate "prompt" key.
    // Preserve it so extract() can merge ComfyUI nodes with TensorArt metadata.
    if (src.prompt) entries.prompt ??= stringifyValue(src.prompt);
  }
  return !!key;
}

/**
 * Normalize heterogeneous entry formats into a uniform shape.
 *
 * Returns a copy of the entries with the generation data channeled to
 * `parameters` (and a ComfyUI graph to `prompt`); the input is not modified.
 * The copy is made once and filled with `??=`, which costs fewer bytes than
 * spreading a new object in every branch. Only identifies WHERE data lives:
 * all actual parsing/extraction is deferred to extract().
 *
 * Entry points by image format:
 *   PNG  → entries already has named keys (parameters, prompt, Comment, etc.)
 *   JPEG → metadata is in EXIF UserComment (plain text or JSON blob)
 *   WebP → same as JPEG (EXIF-based)
 */
function normalize(rawEntries: Entries): Entries {
  const entries = { ...rawEntries };
  // All JPEG/WebP paths except NovelAI go through UserComment.
  const uc = entries.UserComment;

  // NovelAI (PNG/WebP): metadata is in the Comment field.
  // When Software starts with "NovelAI", Comment is always present.
  if (entries.Software?.startsWith('NovelAI'))
    entries[PARAMS] ??= entries.Comment!;
  // No UserComment: check top-level entries for tool-specific keys.
  // This handles PNG images from InvokeAI, Civitai, TensorArt where
  // the data is stored in named PNG tEXt chunks.
  else if (!uc) channelKnownKeys(entries, entries);
  // Plain-text UserComment (not JSON). A1111 / Forge / reForge (JPEG) write
  // A1111-format text with a "Steps:" marker: channel it to parameters.
  // Unknown plain text is left where it is.
  else if (!uc.startsWith('{')) {
    if (uc.includes('Steps:')) entries[PARAMS] ??= uc;
  } else {
    // JSON UserComment — parse the envelope to inspect keys. Civitai,
    // InvokeAI, TensorArt (JPEG) embed their data as nested JSON.
    const obj = parseJson(uc);
    if (obj && !channelKnownKeys(obj, entries)) {
      // ComfyUI (JPEG): UserComment has both "prompt" (node graph) and
      // "workflow" keys. Extract the prompt for flatScan in extract().
      if ('prompt' in obj && 'workflow' in obj)
        entries.prompt ??= stringifyValue(obj.prompt);
      // A1111 / Forge (JPEG variant): some tools wrap A1111-format text
      // inside a JSON object with a "parameters" key. Any other JSON goes
      // to parameters whole, so extract() can attempt tool detection on it.
      else entries[PARAMS] ??= PARAMS in obj ? stringifyValue(obj[PARAMS]) : uc;
    }
  }
  return entries;
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

  // Parsed once for the SwarmUI check and the JSON block. Plain A1111 text
  // does not parse and leaves this null.
  const obj = parseJson(params);

  // --- SwarmUI ---------------------------------------------------------
  // SwarmUI wraps its metadata in a "sui_image_params" key.
  // A1111 text may mention the key too; such text is returned below
  if (obj && params!.includes('sui_image_params'))
    return buildA1111(
      extractCommon((obj.sui_image_params ?? obj) as JsonObject),
    );

  // --- Plain text (A1111 / Forge / reForge) ----------------------------
  // Already in A1111 format — return as-is.
  if (params && !params.startsWith('{')) return params;

  // --- JSON parameters -------------------------------------------------
  // `obj` is only set when params is a non-empty text, hence the `params!`
  if (obj) {
    // Try specific tool detectors (RuinedFooocus, EasyDiffusion,
    // Fooocus, HF Space, NovelAI).
    // NovelAI keeps the model in Source, outside the Comment JSON.
    if (entries.Source) obj.Source = entries.Source;
    const result = tryJsonTool(obj, params!);
    if (result) return result;

    // ComfyUI (PNG): node graph stored directly in parameters.
    if (params!.includes(CT)) return buildA1111(flatScan(params!));

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

  // --- EasyDiffusion (PNG, non-JSON parameters) ------------------------
  // EasyDiffusion stores fields as top-level PNG tEXt entries with a
  // distinctive "use_stable_diffusion_model" key. Its clip_skip is a boolean
  // written as "False"/"True", not an A1111 layer count, so the field is
  // dropped (the JSON form is `false` and already comes out blank).
  if (entries[EASY_DIFF_KEY])
    return buildA1111({ ...extractCommon(entries), cs: '' });

  // --- ComfyUI (PNG, no parameters field) ------------------------------
  // Some ComfyUI outputs only have a "prompt" PNG tEXt chunk
  // containing the node graph (no "parameters" chunk).
  if (prompt?.includes(CT)) return buildA1111(flatScan(prompt));

  // --- Final fallback --------------------------------------------------
  // Return whatever text is available, trying the most likely fields first.
  // C2PA Content Credentials (ChatGPT / Gemini / Grok) carry no generation
  // params, so their generator name is the fallback. It comes before the
  // EXIF text, which a vendor image only uses for its own markers (Grok
  // writes a signature there).
  return (
    params ??
    (readC2paName(entries.cabx) ||
      (entries.UserComment ??
        entries.Comment ??
        entries.ImageDescription ??
        ''))
  );
}

// ============================================================================
// C2PA (Content Credentials)
// ============================================================================

/**
 * Recover the name of the tool that made the image from a caBX manifest
 * captured as a Latin-1 string (1:1 byte view, see readPng): the
 * `softwareAgent` of an action, which names the product (`Kling AI`,
 * `Dreamina/7.5.0`), else `claim_generator_info.name`, the signing program.
 * Detection only — no JUMBF/CBOR decoder and no signature verification.
 *
 * A `softwareAgent` is a text, or a map that starts with a `name`. The `name`
 * key is encoded as 0x64 ('d') + "name", i.e. the run "dname", so its value
 * sits 5 bytes later.
 */
function readC2paName(manifest: string | undefined): string {
  if (!manifest) return '';

  // The value of a `name` key that starts within `max` bytes of a marker. The
  // window is kept short so a stray "...name" elsewhere cannot be misread.
  const nameAfter = (at: number, max: number): string => {
    const p = manifest.indexOf('dname', at);
    return at < 0 || p < 0 || p > at + max ? '' : readCborText(manifest, p + 5);
  };

  // "softwareAgent" is 13 characters: a text value follows it directly, and
  // a map puts one header byte before its "dname"
  const agent = manifest.indexOf('softwareAgent');
  return (
    (agent < 0 ? '' : readCborText(manifest, agent + 13)) ||
    nameAfter(agent, 14) ||
    nameAfter(manifest.indexOf('claim_generator_info'), 256)
  );
}

/**
 * Read a CBOR text string at a position of the Latin-1 view. Names are short
 * ASCII, so only inline (0x60-0x77) and 1-byte (0x78) length headers are
 * read. charCodeAt yields NaN past the string end, which fails every
 * comparison below, so out-of-range offsets fall through to "".
 */
function readCborText(manifest: string, pos: number): string {
  const head = manifest.charCodeAt(pos);
  if (!(head >= 0x60 && head <= 0x78)) return '';

  const oneByte = head === 0x78;
  const length = oneByte ? manifest.charCodeAt(pos + 1) || 0 : head - 0x60;
  const dataPos = pos + (oneByte ? 2 : 1);
  if (dataPos + length > manifest.length) return '';

  return manifest.slice(dataPos, dataPos + length);
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
  if (asText(obj.software).includes('RuinedFooocus'))
    return buildA1111(extractCommon(obj));

  // EasyDiffusion (JSON variant): identified by "use_stable_diffusion_model".
  if (EASY_DIFF_KEY in obj) return buildA1111(extractCommon(obj));

  // Fooocus: identified by having both "Model" (capital M) and "resolution"
  // keys. Resolution format: "1024x1024". Also has optional upscaler data.
  const fooocus = text.includes('"Model"') && text.includes('"resolution"');

  // HF Space / Civitai generator / Fooocus JSON scheme: identified by
  // "base_model" key.
  // Resolution format: "(1024, 1024)" (Python tuple string).
  if (fooocus || 'base_model' in obj) {
    // Both tools take their size from `resolution` alone; only the pattern
    // differs. In the Fooocus one the lookbehind starts a match at the first
    // digit of a run only, so a long run of digits without an "x" is tried
    // once, not from every digit
    const size = asText(obj.resolution).match(
      fooocus ? /(?<!\d)(\d+)\s*x\s*(\d+)/ : /\(\s*(\d+)\s*,\s*(\d+)\s*\)/,
    );
    return buildA1111({ ...extractCommon(obj), w: size?.[1], h: size?.[2] });
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
  const sa = asText(obj.sampler ?? obj.sampler_name);
  const sc = asText(obj.scheduler ?? obj.noise_schedule);
  const mod = obj.model as JsonObject | undefined;
  const base = obj.baseModel as JsonObject | undefined;
  const up = obj.use_upscaler as JsonObject | undefined;
  return {
    // Prompt: Fooocus "full_prompt" (style-resolved parts, joined with ", "
    // like its own a1111 scheme) → "prompt" (most tools) → "Prompt" (Fooocus)
    // → "positive_prompt" (RuinedFooocus)
    p:
      (obj.full_prompt as string[] | undefined)?.join?.(', ') ||
      asText(obj.prompt ?? obj.Prompt ?? obj.positive_prompt),
    // Negative: multiple naming conventions across tools
    // "uc" = NovelAI's "undesired content"
    n:
      (obj.full_negative_prompt as string[] | undefined)?.join?.(', ') ||
      asText(
        obj.negative_prompt ??
          obj.Negative ??
          obj.negativeprompt ??
          obj.negativePrompt ??
          obj.uc,
      ),
    se: asText(obj.seed),
    // "num_inference_steps" = HF Space / Civitai generator
    st: asText(obj.steps ?? obj.num_inference_steps),
    // CFG: many naming variants across tools
    // "scale" = NovelAI, "guidance_scale" = HF Space
    cf: asText(
      obj.cfg ??
        obj.cfg_scale ??
        obj.cfgScale ??
        obj.cfgscale ??
        obj.guidance_scale ??
        obj.scale,
    ),
    // InvokeAI quirk: stores the sampler name in the "scheduler" field
    // and has no separate sampler field. If sa is empty, use sc as sa
    // (and leave sc empty: `sa && sc` is "" then).
    sa: sa || sc,
    sc: sa && sc,
    w: asText(obj.width),
    h: asText(obj.height),
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
      asText(
        mod,
        obj.Model,
        obj.base_model,
        obj.base_model_name,
        base,
        mod?.name,
        base?.modelFileName,
      ) || asText(obj[EASY_DIFF_KEY]).split(/[\\/]/).pop(),
    // Model hash: similar multi-tool fallback chain.
    // "Model hash"    → Fooocus
    // "model.hash"    → Civitai (nested)
    // "baseModel.hash" → TensorArt (nested)
    mh: asText(obj.base_model_hash, obj['Model hash'], mod?.hash, base?.hash),
    cs: asText(obj.clip_skip ?? obj.clipSkip),
    // Hires/upscaler: use_upscaler (Fooocus, HF Space) → refiner* (SwarmUI)
    hs: asText(up?.upscale_by, obj.refinerupscale),
    hu: asText(up?.upscale_method, obj.refinerupscalemethod),
    hd: asText(up?.upscaler_strength, obj.refinercontrolpercentage),
    ht: asText(up?.upscale_steps),
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
  // Source is "<model name> <8-digit hex hash>"
  const src = /^(.+) ([0-9A-F]{8})$/.exec(asText(obj.Source));
  return buildA1111({
    ...extractCommon(obj),
    // Prefer v4 captions, fall back to legacy flat fields. The V5 web
    // client appends quoted texts as ", teXt: ..."; drop that block.
    p: asText(v4Caption?.base_caption, obj.prompt).replace(
      /(^|, )teXt:(?!:).*/s,
      '',
    ),
    n: asText(v4NegCaption?.base_caption, obj.uc),
    // img2img strength (Img2ImgRequest only)
    dn: asText(obj.strength),
    md: src?.[1] ?? asText(obj.Source),
    mh: src?.[2],
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
  // User-prompt fallback: official enhancer templates (e.g. Krea-2 Turbo)
  // hold the user's input in a PrimitiveStringMultiline titled
  // "... (User Prompt)" while CLIPTextEncode only carries node references.
  // Collected during the scan, applied only when no text node yielded a
  // prompt literal.
  let up = '';
  // Pre-clean: strip trailing null bytes (PNG chunks; the lookbehind keeps
  // the trim linear, see channelKnownKeys) and replace NaN literals that
  // some ComfyUI versions emit (invalid JSON).
  const nodes = parseJson(
    json.replace(/(?<!\0)\0+$/, '').replace(/\bNaN\b/g, 'null'),
  );
  if (!nodes) return result;

  for (const key in nodes) {
    // Only a node object can have inputs: null, a text or a number yields
    // undefined here and is skipped, so `node!` below is safe.
    const node = nodes[key] as JsonObject | null;
    const inputs = node?.inputs as JsonObject | undefined;
    if (!inputs) continue;
    const classType = asText(node![CT]);

    if (/User Prompt/.test(asText((node!._meta as JsonObject)?.title)))
      up ||= asText(inputs.value);

    // --- Prompt text nodes -------------------------------------------
    // Matches CLIPTextEncode (and variants like SDXL, Flux) via "TextEncode",
    // text box nodes (DF_Text_Box, TextBox) via ".?Box", ShowText|pysssss
    // (pythongosssss/ComfyUI-Custom-Scripts) which caches composed prompts in
    // inputs.text_0, and PromptStashSaver which holds user-authored prompts in
    // inputs.prompt_text.
    // Unified classification: if class name contains "neg" → negative prompt,
    // otherwise first-come-first-served (1st → positive, 2nd → negative).
    if (/Text(Encode|.?Box)|ShowText|PromptStash/.test(classType)) {
      const txt = asText(
        inputs.text,
        inputs.prompt,
        inputs.Text,
        inputs.prompt_text,
        inputs.text_0,
      );
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
      result.se ||= asText(inputs.seed, inputs.noise_seed);
      result.st ||= asText(inputs.steps);
      result.cf ||= asText(inputs.cfg);
      result.sa ||= asText(inputs.sampler_name);
      result.sc ||= asText(inputs.scheduler);
    }

    // --- Model loader nodes ------------------------------------------
    // ckpt_name / unet_name are unique to checkpoint and UNET loaders —
    // no class_type guard needed; unconditional ||= is safe here.
    result.md ||= asText(inputs.ckpt_name, inputs.unet_name);

    // --- Latent image nodes (for dimensions) -------------------------
    result.w ||= asText(inputs.width);
    result.h ||= asText(inputs.height);
  }
  result.p ||= up;
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
  // "" for an empty value (undefined or ""), which the lists below drop
  const field = (key: string, value: string | undefined) =>
    value ? `${key}: ${value}` : '';

  // Lines, then the fields of the last line: empty ones are filtered out
  return [
    params.p,
    field('Negative prompt', params.n),
    [
      field('Steps', params.st),
      field('Sampler', params.sa),
      field('Schedule type', params.sc),
      field('CFG scale', params.cf),
      field('Seed', params.se),
      field('Size', params.w && params.h && `${params.w}x${params.h}`),
      field('Model hash', params.mh),
      field('Model', params.md),
      field('Clip skip', params.cs),
      // Denoising strength: dn (standard) or hd (Fooocus refiner percentage).
      field('Denoising strength', params.dn ?? params.hd),
      field('Hires upscale', params.hs),
      field('Hires steps', params.ht),
      field('Hires upscaler', params.hu),
    ]
      .filter(Boolean)
      .join(', '),
  ]
    .filter(Boolean)
    .join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Coerce a scalar to text. Strings pass through unchanged (a 64-bit seed
 * written as a string keeps every digit), numbers are stringified (one
 * written as a JSON number was already rounded past 2^53 by JSON.parse),
 * and anything else — missing, null, objects, ComfyUI node references like
 * ["95", 0] — becomes "".
 *
 * Every value ends up interpolated into A1111 text, so there is no reason to
 * hold numbers as numbers.
 *
 * Given several candidates, returns the first one that yields text, so
 * `asText(a, b)` reads like `asText(a) || asText(b)` at a fraction of the
 * bytes. An empty string is skipped like a missing value; a number never is
 * (0 gives "0").
 */
function asText(...values: unknown[]): string {
  const found = values.find(
    (v) => (typeof v === 'string' && v) || typeof v === 'number',
  );
  return `${found ?? ''}`;
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
