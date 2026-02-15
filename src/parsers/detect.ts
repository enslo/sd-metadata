import type { GenerationSoftware } from '../types';
import type { EntryRecord } from '../utils/entries';

// =============================================================================
// Detection Marker Strings
// =============================================================================

// Unique chunk keywords
const M_INVOKEAI = 'invokeai_metadata';
const M_TENSORART = 'generation_data';
const M_STABILITY_MATRIX = 'smproj';
const M_CIVITAI_EXTRA = 'extraMetadata';

// Content patterns
const M_SWARMUI = 'sui_image_params';
const M_SWARM_VERSION = 'swarm_version';
const M_COMFYUI_NODE = 'class_type';
const M_NOVELAI_SCHEDULE = 'noise_schedule';
const M_NOVELAI_V4 = 'v4_prompt';
const M_NOVELAI_UNCOND = 'uncond_scale';
const M_CIVITAI_NS = 'civitai:';
const M_CIVITAI_RESOURCES = 'Civitai resources:';
const M_RUINED_FOOOCUS = 'RuinedFooocus';
const M_EASYDIFFUSION = 'use_stable_diffusion_model';
const M_HF_MODEL = '"Model"';
const M_HF_RESOLUTION = '"resolution"';
const M_FOOOCUS_BASE = '"base_model"';

/**
 * Detect generation software from metadata entries
 *
 * Analyzes entry keywords and content to identify the software that
 * generated the image. This centralized detection allows parsers to
 * focus on extracting structured data.
 *
 * @param entries - Metadata entries to analyze
 * @returns Detected software or null if unknown
 */
export function detectSoftware(
  entries: EntryRecord,
): GenerationSoftware | null {
  // Tier 1: Fastest - unique keywords
  const uniqueResult = detectUniqueKeywords(entries);
  if (uniqueResult) return uniqueResult;

  // Tier 2: Format-specific structured detection
  const comfyResult = detectComfyUIEntries(entries);
  if (comfyResult) return comfyResult;

  // Tier 3: Content analysis
  const text = entries.parameters ?? entries.UserComment ?? entries.Comment;
  if (text) {
    return detectFromTextContent(text);
  }

  return null;
}

/**
 * Detect software from unique chunk keywords
 *
 * Checks for presence of keys that uniquely identify software.
 * Used for both direct entry records (PNG) and parsed JSON (JPEG/WebP conversions).
 */
function detectByUniqueKey(
  record: Record<string, unknown>,
): GenerationSoftware | null {
  if (M_INVOKEAI in record) return 'invokeai';
  if (M_TENSORART in record) return 'tensorart';
  if (M_STABILITY_MATRIX in record) return 'stability-matrix';
  if (M_CIVITAI_EXTRA in record) return 'civitai';
  return null;
}

/**
 * Detect software from unique keywords (Tier 1)
 *
 * Fast path: checks for presence of specific keywords that uniquely
 * identify each software. These are the most reliable indicators.
 *
 * Includes:
 * - Unique PNG chunk keywords
 * - Unique content patterns in parameters
 * - JPEG/WebP Comment JSON parsing (conversion cases)
 */
function detectUniqueKeywords(
  entryRecord: EntryRecord,
): GenerationSoftware | null {
  // ========================================
  // PNG Chunk Keywords
  // ========================================

  // NovelAI: Uses "Software" chunk with "NovelAI" value
  if (entryRecord.Software?.startsWith('NovelAI')) {
    return 'novelai';
  }

  // Unique key detection (InvokeAI, TensorArt, Stability Matrix, CivitAI)
  const keyResult = detectByUniqueKey(entryRecord);
  if (keyResult) return keyResult;

  // Easy Diffusion: Has "negative_prompt" or "Negative Prompt" keyword
  if ('negative_prompt' in entryRecord || 'Negative Prompt' in entryRecord) {
    return 'easydiffusion';
  }

  // ========================================
  // Parameters Content Patterns
  // ========================================

  // SwarmUI: Check parameters for "sui_image_params"
  // MUST check here to catch it before ComfyUI detection
  const parameters = entryRecord.parameters;
  if (parameters?.includes(M_SWARMUI)) {
    return 'swarmui';
  }

  // ========================================
  // JPEG/WebP UserComment/Comment JSON
  // ========================================

  // Check UserComment (Exif) first, then Comment (JPEG COM)
  const comment = entryRecord.UserComment ?? entryRecord.Comment;
  if (comment?.startsWith('{')) {
    return detectFromCommentJson(comment);
  }

  return null;
}

/**
 * Detect software from Comment JSON (conversion cases)
 *
 * Handles PNG→JPEG/WebP conversions where chunks become JSON.
 */
function detectFromCommentJson(comment: string): GenerationSoftware | null {
  try {
    const parsed = JSON.parse(comment) as Record<string, unknown>;

    // Unique key detection (InvokeAI, TensorArt, Stability Matrix, CivitAI)
    const keyResult = detectByUniqueKey(parsed);
    if (keyResult) return keyResult;

    // ComfyUI: Has both prompt and workflow in JSON
    if ('prompt' in parsed && 'workflow' in parsed) {
      const workflow = parsed.workflow;
      const prompt = parsed.prompt;

      const isObject =
        typeof workflow === 'object' || typeof prompt === 'object';
      const isJsonString =
        (typeof workflow === 'string' && workflow.startsWith('{')) ||
        (typeof prompt === 'string' && prompt.startsWith('{'));

      if (isObject || isJsonString) {
        return 'comfyui';
      }
    }

    // SwarmUI: Same as parameters check, but from Comment JSON
    if (M_SWARMUI in parsed) {
      return 'swarmui';
    }

    // SwarmUI alternative format
    if ('prompt' in parsed && 'parameters' in parsed) {
      const params = String(parsed.parameters || '');
      if (params.includes(M_SWARMUI) || params.includes(M_SWARM_VERSION)) {
        return 'swarmui';
      }
    }
  } catch {
    // Invalid JSON
  }

  return null;
}

/**
 * Detect ComfyUI from specific entry combinations (Tier 2)
 *
 * ComfyUI has unique entry combinations that can be detected
 * before analyzing text content.
 */
function detectComfyUIEntries(
  entryRecord: EntryRecord,
): GenerationSoftware | null {
  // ComfyUI: Both prompt AND workflow chunks exist
  // Checks both lowercase (PNG) and capitalized (EXIF prefix) keys
  if (
    ('prompt' in entryRecord && 'workflow' in entryRecord) ||
    ('Prompt' in entryRecord && 'Workflow' in entryRecord)
  ) {
    return 'comfyui';
  }

  // ComfyUI: Workflow chunk only (rare, but valid)
  if ('workflow' in entryRecord || 'Workflow' in entryRecord) {
    return 'comfyui';
  }

  // ComfyUI: Prompt chunk with workflow JSON data
  // IMPORTANT: Check SwarmUI and CivitAI FIRST
  const promptText = entryRecord.prompt ?? entryRecord.Prompt;
  if (promptText?.startsWith('{')) {
    // SwarmUI: Must check FIRST
    if (promptText.includes(M_SWARMUI)) {
      return 'swarmui';
    }

    // CivitAI: Has extraMetadata key in prompt JSON
    // This detects CivitAI Orchestration format where all data is in single prompt chunk
    if (promptText.includes(`"${M_CIVITAI_EXTRA}"`)) {
      return 'civitai';
    }

    // ComfyUI: Has class_type in prompt JSON
    if (promptText.includes(M_COMFYUI_NODE)) {
      return 'comfyui';
    }
  }

  return null;
}

/**
 * Detect software from text content (Tier 3)
 *
 * Analyzes text content which can be either JSON format or A1111 text format.
 * This is the slowest but most thorough detection path.
 */
function detectFromTextContent(text: string): GenerationSoftware | null {
  // JSON format detection
  if (text.startsWith('{')) {
    return detectFromJsonFormat(text);
  }

  // A1111-style text format detection
  return detectFromA1111Format(text);
}

/**
 * Detect software from JSON-formatted metadata
 *
 * Priority order:
 * 1. Unique string patterns (most specific)
 * 2. Multi-field combinations (moderately specific)
 * 3. Generic patterns (least specific, fallback)
 */
function detectFromJsonFormat(json: string): GenerationSoftware | null {
  // ========================================
  // Tier 1: Unique String Identifiers
  // ========================================

  // SwarmUI: Has "sui_image_params" (unique identifier)
  if (json.includes(M_SWARMUI)) {
    return 'swarmui';
  }

  // Ruined Fooocus: Has explicit software field
  if (
    json.includes(`"software":"${M_RUINED_FOOOCUS}"`) ||
    json.includes(`"software": "${M_RUINED_FOOOCUS}"`)
  ) {
    return 'ruined-fooocus';
  }

  // Easy Diffusion: Has unique field name
  if (json.includes(`"${M_EASYDIFFUSION}"`)) {
    return 'easydiffusion';
  }

  // CivitAI: Has "civitai:" namespace prefix OR "extraMetadata" key
  if (json.includes(M_CIVITAI_NS) || json.includes(`"${M_CIVITAI_EXTRA}"`)) {
    return 'civitai';
  }

  // ========================================
  // Tier 2: Multi-Field Combinations
  // ========================================

  // NovelAI: Has distinctive v4_prompt or noise_schedule fields
  if (
    json.includes(`"${M_NOVELAI_V4}"`) ||
    json.includes(`"${M_NOVELAI_SCHEDULE}"`) ||
    json.includes(`"${M_NOVELAI_UNCOND}"`) ||
    json.includes('"Software":"NovelAI"') ||
    json.includes(`\\"${M_NOVELAI_SCHEDULE}\\"`) ||
    json.includes(`\\"${M_NOVELAI_V4}\\"`)
  ) {
    return 'novelai';
  }

  // HuggingFace Space: Combination of Model + resolution
  if (json.includes(M_HF_MODEL) && json.includes(M_HF_RESOLUTION)) {
    return 'hf-space';
  }

  // Fooocus: Has prompt + base_model combination
  if (json.includes('"prompt"') && json.includes(M_FOOOCUS_BASE)) {
    return 'fooocus';
  }

  // ========================================
  // Tier 3: Generic Fallback Patterns
  // ========================================

  // ComfyUI: Has "prompt" or "nodes" (very generic, last resort)
  if (json.includes('"prompt"') || json.includes('"nodes"')) {
    return 'comfyui';
  }

  return null;
}

/**
 * Detect software from A1111-style text format
 *
 * Priority order:
 * 1. SwarmUI indicators (check first as it has unique markers)
 * 2. Version field analysis (sd-webui, forge family, comfyui)
 * 3. App field (SD.Next)
 * 4. Resource markers (Civitai)
 * 5. Default A1111 format (steps + sampler, fallback for embed-created data)
 */
function detectFromA1111Format(text: string): GenerationSoftware | null {
  // ========================================
  // Tier 1: SwarmUI Detection
  // ========================================

  // SwarmUI: Has sui_image_params or swarm_version
  if (text.includes(M_SWARMUI) || text.includes(M_SWARM_VERSION)) {
    return 'swarmui';
  }

  // ========================================
  // Tier 2: Version Field Analysis
  // ========================================

  const versionMatch = text.match(/Version:\s*([^\s,]+)/);
  if (versionMatch) {
    const version = versionMatch[1];

    // SD WebUI: Version starts with "v" + digit (e.g., "v1.10.1")
    if (version && /^v\d/.test(version)) {
      return 'sd-webui';
    }

    // Forge Classic: Version is literal "classic"
    if (version === 'classic') {
      return 'forge-classic';
    }

    // Forge Neo: Version starts with "neo"
    if (version === 'neo' || version?.startsWith('neo')) {
      return 'forge-neo';
    }

    // Forge family: Version starts with "f" followed by a digit
    if (version?.startsWith('f') && /^f\d/.test(version)) {
      // EasyReforge: f{semver}-v pattern (dash directly after forge semver)
      if (/^f\d+\.\d+(\.\d+)?-v/.test(version)) return 'easy-reforge';
      // reForge: f{semver}v{N}-v pattern (version number then dash-v)
      if (/^f\d+\.\d+(\.\d+)?v\d+-v/.test(version)) return 'reforge';
      // Forge: remaining f{digit} prefix (default for current Forge)
      return 'forge';
    }

    // ComfyUI: Version explicitly says "ComfyUI"
    if (version === 'ComfyUI') {
      return 'comfyui';
    }
  }

  // ========================================
  // Tier 3: Other Unique Text Markers
  // ========================================

  // SD.Next: Has App field with SD.Next value
  if (text.includes('App: SD.Next') || text.includes('App:SD.Next')) {
    return 'sd-next';
  }

  // Civitai: Has resource list marker
  if (text.includes(M_CIVITAI_RESOURCES)) {
    return 'civitai';
  }

  // ========================================
  // Tier 4: Default A1111 Format (fallback)
  // ========================================

  // SD-WebUI (fallback): Has typical A1111 parameters but no Version field.
  // Catches embed()-created data and legacy images without version info.
  if (
    text.includes('Steps:') ||
    text.includes('Sampler:') ||
    text.includes('Negative prompt:')
  ) {
    return 'sd-webui';
  }

  return null;
}
