import type { GenerationSoftware, MetadataEntry } from '../types';
import { type EntryRecord, buildEntryRecord } from '../utils/entries';

// =============================================================================
// Detection Markers
// =============================================================================

/**
 * Detection marker strings for identifying software
 *
 * Centralizes magic strings used across detection functions for maintainability.
 */
const MARKERS = {
  // Unique chunk keywords
  INVOKEAI: 'invokeai_metadata',
  TENSORART: 'generation_data',
  STABILITY_MATRIX: 'smproj',
  EASYDIFFUSION: 'use_stable_diffusion_model',
  CIVITAI_EXTRA: 'extraMetadata',

  // Content patterns
  SWARMUI: 'sui_image_params',
  SWARM_VERSION: 'swarm_version',
  COMFYUI_NODE: 'class_type',
  NOVELAI_SCHEDULE: 'noise_schedule',
  NOVELAI_V4: 'v4_prompt',
  NOVELAI_UNCOND: 'uncond_scale',
  CIVITAI_NS: 'civitai:',
  CIVITAI_RESOURCES: 'Civitai resources:',
  RUINED_FOOOCUS: 'RuinedFooocus',
  HF_MODEL: '"Model"',
  HF_RESOLUTION: '"resolution"',
  FOOOCUS_BASE: '"base_model"',
} as const;

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
  entries: MetadataEntry[],
): GenerationSoftware | null {
  const entryRecord = buildEntryRecord(entries);

  // Tier 1: Fastest - unique keywords
  const uniqueResult = detectUniqueKeywords(entryRecord);
  if (uniqueResult) return uniqueResult;

  // Tier 2: Format-specific structured detection
  const comfyResult = detectComfyUIEntries(entryRecord);
  if (comfyResult) return comfyResult;

  // Tier 3: Content analysis
  const text = entryRecord.parameters ?? entryRecord.Comment ?? '';
  if (text) {
    return detectFromTextContent(text);
  }

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

  // InvokeAI: Has unique "invokeai_metadata" chunk
  if (MARKERS.INVOKEAI in entryRecord) {
    return 'invokeai';
  }

  // TensorArt: Has unique "generation_data" chunk
  if (MARKERS.TENSORART in entryRecord) {
    return 'tensorart';
  }

  // Stability Matrix: Has unique "smproj" chunk
  if (MARKERS.STABILITY_MATRIX in entryRecord) {
    return 'stability-matrix';
  }

  // Easy Diffusion: Has "negative_prompt" or "Negative Prompt" keyword
  if ('negative_prompt' in entryRecord || 'Negative Prompt' in entryRecord) {
    return 'easydiffusion';
  }

  // CivitAI Orchestration: Has "extraMetadata" keyword (unique to CivitAI)
  // Note: "extraMetadata" is specific to CivitAI's Orchestration format
  // "resource-stack" may or may not be present depending on the workflow
  if (MARKERS.CIVITAI_EXTRA in entryRecord) {
    return 'civitai';
  }

  // ========================================
  // Parameters Content Patterns
  // ========================================

  // SwarmUI: Check parameters for "sui_image_params"
  // MUST check here to catch it before ComfyUI detection
  const parameters = entryRecord.parameters;
  if (parameters?.includes(MARKERS.SWARMUI)) {
    return 'swarmui';
  }

  // ========================================
  // JPEG/WebP Comment JSON
  // ========================================

  const comment = entryRecord.Comment;
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

    // InvokeAI: Same as PNG chunk check, but from JSON
    if (MARKERS.INVOKEAI in parsed) {
      return 'invokeai';
    }

    // TensorArt: Same as PNG chunk check, but from JSON
    if (MARKERS.TENSORART in parsed) {
      return 'tensorart';
    }

    // Stability Matrix: Same as PNG chunk check, but from JSON
    if (MARKERS.STABILITY_MATRIX in parsed) {
      return 'stability-matrix';
    }

    // CivitAI Orchestration: Has "extraMetadata" in JSON (unique to CivitAI)
    if (MARKERS.CIVITAI_EXTRA in parsed) {
      return 'civitai';
    }

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
    if (MARKERS.SWARMUI in parsed) {
      return 'swarmui';
    }

    // SwarmUI alternative format
    if ('prompt' in parsed && 'parameters' in parsed) {
      const params = String(parsed.parameters || '');
      if (
        params.includes(MARKERS.SWARMUI) ||
        params.includes(MARKERS.SWARM_VERSION)
      ) {
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
  if ('prompt' in entryRecord && 'workflow' in entryRecord) {
    return 'comfyui';
  }

  // ComfyUI: Workflow chunk only (rare, but valid)
  if ('workflow' in entryRecord) {
    return 'comfyui';
  }

  // ComfyUI: Prompt chunk with workflow JSON data
  // IMPORTANT: Check SwarmUI and CivitAI FIRST
  if ('prompt' in entryRecord) {
    const promptText = entryRecord.prompt;
    if (promptText?.startsWith('{')) {
      // SwarmUI: Must check FIRST
      if (promptText.includes(MARKERS.SWARMUI)) {
        return 'swarmui';
      }

      // CivitAI: Has extraMetadata key in prompt JSON
      // This detects CivitAI Orchestration format where all data is in single prompt chunk
      if (promptText.includes(`"${MARKERS.CIVITAI_EXTRA}"`)) {
        return 'civitai';
      }

      // ComfyUI: Has class_type in prompt JSON
      if (promptText.includes(MARKERS.COMFYUI_NODE)) {
        return 'comfyui';
      }
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
  if (json.includes(MARKERS.SWARMUI)) {
    return 'swarmui';
  }

  // Ruined Fooocus: Has explicit software field
  if (
    json.includes(`"software":"${MARKERS.RUINED_FOOOCUS}"`) ||
    json.includes(`"software": "${MARKERS.RUINED_FOOOCUS}"`)
  ) {
    return 'ruined-fooocus';
  }

  // Easy Diffusion: Has unique field name
  if (json.includes(`"${MARKERS.EASYDIFFUSION}"`)) {
    return 'easydiffusion';
  }

  // CivitAI: Has "civitai:" namespace prefix OR "extraMetadata" key
  if (
    json.includes(MARKERS.CIVITAI_NS) ||
    json.includes(`"${MARKERS.CIVITAI_EXTRA}"`)
  ) {
    return 'civitai';
  }

  // ========================================
  // Tier 2: Multi-Field Combinations
  // ========================================

  // NovelAI: Has distinctive v4_prompt or noise_schedule fields
  if (
    json.includes(`"${MARKERS.NOVELAI_V4}"`) ||
    json.includes(`"${MARKERS.NOVELAI_SCHEDULE}"`) ||
    json.includes(`"${MARKERS.NOVELAI_UNCOND}"`) ||
    json.includes('"Software":"NovelAI"') ||
    json.includes(`\\"${MARKERS.NOVELAI_SCHEDULE}\\"`) ||
    json.includes(`\\"${MARKERS.NOVELAI_V4}\\"`)
  ) {
    return 'novelai';
  }

  // HuggingFace Space: Combination of Model + resolution
  if (json.includes(MARKERS.HF_MODEL) && json.includes(MARKERS.HF_RESOLUTION)) {
    return 'hf-space';
  }

  // Fooocus: Has prompt + base_model combination
  if (json.includes('"prompt"') && json.includes(MARKERS.FOOOCUS_BASE)) {
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
 * 2. Version field analysis (forge, forge-neo, comfyui variants)
 * 3. App field (SD.Next)
 * 4. Resource markers (Civitai)
 * 5. Default A1111 format (steps + sampler)
 */
function detectFromA1111Format(text: string): GenerationSoftware | null {
  // ========================================
  // Tier 1: SwarmUI Detection
  // ========================================

  // SwarmUI: Has sui_image_params or swarm_version
  if (text.includes(MARKERS.SWARMUI) || text.includes(MARKERS.SWARM_VERSION)) {
    return 'swarmui';
  }

  // ========================================
  // Tier 2: Version Field Analysis
  // ========================================

  const versionMatch = text.match(/Version:\s*([^\s,]+)/);
  if (versionMatch) {
    const version = versionMatch[1];

    // Forge Neo: Version starts with "neo"
    if (version === 'neo' || version?.startsWith('neo')) {
      return 'forge-neo';
    }

    // Forge: Version starts with "f" followed by a digit
    if (version?.startsWith('f') && /^f\d/.test(version)) {
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
  if (text.includes(MARKERS.CIVITAI_RESOURCES)) {
    return 'civitai';
  }

  // ========================================
  // Tier 4: Default A1111 Format
  // ========================================

  // SD-WebUI (default): Has typical A1111 parameters
  if (text.includes('Steps:') && text.includes('Sampler:')) {
    return 'sd-webui';
  }

  return null;
}
