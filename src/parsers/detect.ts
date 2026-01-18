import type { GenerationSoftware, MetadataEntry } from '../types';
import { type EntryRecord, buildEntryRecord } from '../utils/entries';

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

  // First try keyword-based detection (fast path)
  const keywordResult = detectFromKeywords(entryRecord);
  if (keywordResult) return keywordResult;

  // Then try content-based detection (slower but more thorough)
  return detectFromContent(entryRecord);
}

/**
 * Detect software from entry keywords
 *
 * Fast path: checks for presence of specific keywords that uniquely
 * identify each software. These are the most reliable indicators.
 *
 * Priority order:
 * 1. Unique PNG chunk keywords (fastest, most reliable)
 * 2. Unique content patterns in parameters
 * 3. JPEG/WebP Comment JSON parsing (conversion cases)
 */
function detectFromKeywords(
  entryRecord: EntryRecord,
): GenerationSoftware | null {
  // ========================================
  // Tier 1: Unique PNG Chunk Keywords
  // These are absolutely unique and can be detected instantly
  // ========================================

  // NovelAI: Uses "Software" chunk with "NovelAI" value
  if (entryRecord.Software === 'NovelAI') {
    return 'novelai';
  }

  // InvokeAI: Has unique "invokeai_metadata" chunk
  if ('invokeai_metadata' in entryRecord) {
    return 'invokeai';
  }

  // TensorArt: Has unique "generation_data" chunk
  if ('generation_data' in entryRecord) {
    return 'tensorart';
  }

  // Stability Matrix: Has unique "smproj" chunk
  if ('smproj' in entryRecord) {
    return 'stability-matrix';
  }

  // Easy Diffusion: Has "negative_prompt" or "Negative Prompt" keyword
  // (unusual casing makes this pretty unique)
  if ('negative_prompt' in entryRecord || 'Negative Prompt' in entryRecord) {
    return 'easydiffusion';
  }

  // ========================================
  // Tier 2: Unique Content Patterns
  // Check for distinctive text patterns in parameters
  // ========================================

  // SwarmUI: Check parameters for "sui_image_params"
  // MUST check BEFORE prompt-based ComfyUI detection because:
  // - SwarmUI files often have BOTH SwarmUI parameters AND ComfyUI prompt chunks
  // - sui_image_params is absolutely unique to SwarmUI
  const parameters = entryRecord.parameters;
  if (parameters?.includes('sui_image_params')) {
    return 'swarmui';
  }

  // ========================================
  // Tier 3: JPEG/WebP Comment JSON Detection
  // These handle PNG→JPEG/WebP conversions where chunks become JSON
  // ========================================

  const comment = entryRecord.Comment;
  if (comment?.startsWith('{')) {
    try {
      const parsed = JSON.parse(comment) as Record<string, unknown>;

      // InvokeAI: Same as PNG chunk check, but from JSON
      if ('invokeai_metadata' in parsed) {
        return 'invokeai';
      }

      // ComfyUI: Has both prompt and workflow in JSON
      // This is our converter's output OR saveimage-plus node output
      if ('prompt' in parsed && 'workflow' in parsed) {
        const workflow = parsed.workflow;
        const prompt = parsed.prompt;

        // Values can be objects (saveimage-plus) or JSON strings (our format)
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
      if ('sui_image_params' in parsed) {
        return 'swarmui';
      }

      // SwarmUI alternative format: has prompt + parameters (not workflow)
      // with SwarmUI-specific content
      if ('prompt' in parsed && 'parameters' in parsed) {
        const params = String(parsed.parameters || '');
        if (
          params.includes('sui_image_params') ||
          params.includes('swarm_version')
        ) {
          return 'swarmui';
        }
      }
    } catch {
      // Invalid JSON, will fall through to content-based detection
    }
  }

  return null;
}

/**
 * Detect software from entry content
 *
 * Slower path: analyzes the content of text entries to identify
 * software based on patterns in the metadata.
 *
 * This is called after keyword-based detection fails, so we know
 * the software doesn't have unique keywords.
 */
function detectFromContent(
  entryRecord: EntryRecord,
): GenerationSoftware | null {
  // ========================================
  // ComfyUI-Specific Entry Detection
  // Check for ComfyUI's unique entry combinations
  // ========================================

  // ComfyUI: Both prompt AND workflow chunks exist
  // This handles custom nodes like SaveImageWithMetadata that output
  // both A1111-style parameters AND ComfyUI prompt/workflow
  if ('prompt' in entryRecord && 'workflow' in entryRecord) {
    return 'comfyui';
  }

  // ComfyUI: Workflow chunk only (rare, but valid)
  if ('workflow' in entryRecord) {
    return 'comfyui';
  }

  // ComfyUI: Prompt chunk with workflow JSON data
  // Check for prompt-only chunks containing ComfyUI workflow
  // IMPORTANT: Check SwarmUI BEFORE ComfyUI because SwarmUI files
  // can also have prompt chunks with class_type
  if ('prompt' in entryRecord) {
    const promptText = entryRecord.prompt;
    if (promptText?.startsWith('{')) {
      // SwarmUI: Has sui_image_params in prompt JSON
      // Must check FIRST because SwarmUI also has class_type
      if (promptText.includes('sui_image_params')) {
        return 'swarmui';
      }

      // ComfyUI: Has class_type in prompt JSON (workflow data)
      if (promptText.includes('class_type')) {
        return 'comfyui';
      }
    }
  }

  // ========================================
  // Parameters/Comment Text Analysis
  // Analyze the main text content (A1111 format or JSON)
  // ========================================

  const text = entryRecord.parameters ?? entryRecord.Comment ?? '';

  if (!text) {
    return null;
  }

  // JSON format detection
  if (text.startsWith('{')) {
    return detectFromJson(text);
  }

  // A1111-style text format detection
  return detectFromA1111Text(text);
}

/**
 * Detect software from JSON-formatted metadata
 *
 * Priority order:
 * 1. Unique string patterns (most specific)
 * 2. Multi-field combinations (moderately specific)
 * 3. Generic patterns (least specific, fallback)
 */
function detectFromJson(json: string): GenerationSoftware | null {
  // ========================================
  // Tier 1: Unique String Identifiers
  // These are absolutely unique to their tools
  // ========================================

  // SwarmUI: Has "sui_image_params" (unique identifier)
  if (json.includes('sui_image_params')) {
    return 'swarmui';
  }

  // Ruined Fooocus: Has explicit software field
  if (
    json.includes('"software":"RuinedFooocus"') ||
    json.includes('"software": "RuinedFooocus"')
  ) {
    return 'ruined-fooocus';
  }

  // Easy Diffusion: Has unique field name
  if (json.includes('"use_stable_diffusion_model"')) {
    return 'easydiffusion';
  }

  // Civitai: Has distinctive namespace or field
  if (json.includes('civitai:') || json.includes('"resource-stack"')) {
    return 'civitai';
  }

  // ========================================
  // Tier 2: Multi-Field Combinations
  // These require multiple fields to be present
  // ========================================

  // NovelAI: Has distinctive v4_prompt or noise_schedule fields
  // (escaped quotes handle converted metadata)
  if (
    json.includes('"v4_prompt"') ||
    json.includes('"noise_schedule"') ||
    json.includes('"uncond_scale"') ||
    json.includes('"Software":"NovelAI"') ||
    json.includes('\\"noise_schedule\\"') ||
    json.includes('\\"v4_prompt\\"')
  ) {
    return 'novelai';
  }

  // HuggingFace Space: Combination of Model + resolution
  // (generic names, but combination is distinctive)
  if (json.includes('"Model"') && json.includes('"resolution"')) {
    return 'hf-space';
  }

  // Fooocus: Has prompt + base_model combination
  if (json.includes('"prompt"') && json.includes('"base_model"')) {
    return 'fooocus';
  }

  // ========================================
  // Tier 3: Generic Fallback Patterns
  // Least specific  - only check if nothing else matches
  // ========================================

  // ComfyUI: Has "prompt" or "nodes" (very generic, last resort)
  // Note: Many tools use "prompt", so this is truly a fallback
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
function detectFromA1111Text(text: string): GenerationSoftware | null {
  // ========================================
  // Tier 1: SwarmUI Detection
  // Check SwarmUI FIRST as it has unique, reliable markers
  // ========================================

  // SwarmUI: Has sui_image_params or swarm_version
  if (text.includes('sui_image_params') || text.includes('swarm_version')) {
    return 'swarmui';
  }

  // ========================================
  // Tier 2: Version Field Analysis
  // Many A1111 forks use the Version field to identify themselves
  // ========================================

  const versionMatch = text.match(/Version:\s*([^\s,]+)/);
  if (versionMatch) {
    const version = versionMatch[1];

    // Forge Neo: Version starts with "neo"
    if (version === 'neo' || version?.startsWith('neo')) {
      return 'forge-neo';
    }

    // Forge: Version starts with "f" followed by a digit (e.g., f1.0.0)
    if (version?.startsWith('f') && /^f\d/.test(version)) {
      return 'forge';
    }

    // ComfyUI: Version explicitly says "ComfyUI" (rare A1111 format output)
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
  if (text.includes('Civitai resources:')) {
    return 'civitai';
  }

  // ========================================
  // Tier 4: Default A1111 Format
  // If it has Steps + Sampler, it's likely standard A1111
  // This is the fallback for all unidentified A1111-format tools
  // ========================================

  // SD-WebUI (default): Has typical A1111 parameters
  if (text.includes('Steps:') && text.includes('Sampler:')) {
    return 'sd-webui';
  }

  return null;
}
