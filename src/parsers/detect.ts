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
 * identify each software.
 */
function detectFromKeywords(
  entryRecord: EntryRecord,
): GenerationSoftware | null {
  // NovelAI: Software = "NovelAI"
  if (entryRecord.Software === 'NovelAI') {
    return 'novelai';
  }

  // InvokeAI: has invokeai_metadata entry
  if ('invokeai_metadata' in entryRecord) {
    return 'invokeai';
  }

  // TensorArt: has generation_data entry
  if ('generation_data' in entryRecord) {
    return 'tensorart';
  }

  // Stability Matrix: has smproj entry
  if ('smproj' in entryRecord) {
    return 'stability-matrix';
  }

  // Easy Diffusion: has negative_prompt or Negative Prompt entry
  if ('negative_prompt' in entryRecord || 'Negative Prompt' in entryRecord) {
    return 'easydiffusion';
  }

  // For JPEG/WebP: Check if Comment contains JSON with specific keys
  // This handles cases where PNG chunks were converted to JPEG/WebP
  const comment = entryRecord.Comment;
  if (comment?.startsWith('{')) {
    try {
      const parsed = JSON.parse(comment) as Record<string, unknown>;

      // InvokeAI: has invokeai_metadata key in JSON
      if ('invokeai_metadata' in parsed) {
        return 'invokeai';
      }

      // ComfyUI: has both prompt and workflow keys in JSON
      // Values can be either:
      // 1. Objects (saveimage-plus format): {"prompt": {"nodes": [...]}, "workflow": {...}}
      // 2. JSON strings (our converter): {"prompt": "{\"nodes\": [...]}", "workflow": "..."}
      if ('prompt' in parsed && 'workflow' in parsed) {
        const workflow = parsed.workflow;
        const prompt = parsed.prompt;

        // Check if values are objects (saveimage-plus) or JSON strings (our format)
        const isObject =
          typeof workflow === 'object' || typeof prompt === 'object';
        const isJsonString =
          (typeof workflow === 'string' && workflow.startsWith('{')) ||
          (typeof prompt === 'string' && prompt.startsWith('{'));

        if (isObject || isJsonString) {
          return 'comfyui';
        }
      }

      // SwarmUI: has sui_image_params key in JSON
      if ('sui_image_params' in parsed) {
        return 'swarmui';
      }

      // SwarmUI alternative: has both prompt and parameters keys
      // (different from ComfyUI which has workflow, and values are plain text)
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
      // Not valid JSON, continue to content-based detection
    }
  }

  return null;
}

/**
 * Detect software from entry content
 *
 * Slower path: analyzes the content of text entries to identify
 * software based on patterns in the metadata.
 */
function detectFromContent(
  entryRecord: EntryRecord,
): GenerationSoftware | null {
  // ComfyUI: prioritize if both prompt and workflow exist
  // This handles custom nodes like SaveImageWithMetadata that output both
  // A1111-style parameters AND ComfyUI prompt/workflow
  if ('prompt' in entryRecord && 'workflow' in entryRecord) {
    return 'comfyui';
  }

  // Check parameters entry (PNG) or Comment entry (JPEG/WebP)
  const text = entryRecord.parameters ?? entryRecord.Comment ?? '';

  if (!text) {
    // Check for workflow entry (ComfyUI)
    if ('workflow' in entryRecord) {
      return 'comfyui';
    }
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
 */
function detectFromJson(json: string): GenerationSoftware | null {
  // SwarmUI: has sui_image_params
  if (json.includes('sui_image_params')) {
    return 'swarmui';
  }

  // Civitai JSON format
  if (json.includes('civitai:') || json.includes('"resource-stack"')) {
    return 'civitai';
  }

  // NovelAI JSON format
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

  // HuggingFace Space JSON format (Gradio + Diffusers)
  if (json.includes('"Model"') && json.includes('"resolution"')) {
    return 'hf-space';
  }

  // Easy Diffusion: has use_stable_diffusion_model
  if (json.includes('"use_stable_diffusion_model"')) {
    return 'easydiffusion';
  }

  // Ruined Fooocus: has software = "RuinedFooocus"
  if (
    json.includes('"software":"RuinedFooocus"') ||
    json.includes('"software": "RuinedFooocus"')
  ) {
    return 'ruined-fooocus';
  }

  // Fooocus: has prompt + base_model
  if (json.includes('"prompt"') && json.includes('"base_model"')) {
    return 'fooocus';
  }

  // ComfyUI JSON format
  if (json.includes('"prompt"') || json.includes('"nodes"')) {
    return 'comfyui';
  }

  return null;
}

/**
 * Detect software from A1111-style text format
 */
function detectFromA1111Text(text: string): GenerationSoftware | null {
  // SwarmUI: has sui_image_params in text
  if (text.includes('sui_image_params')) {
    return 'swarmui';
  }

  // Check swarm_version
  if (text.includes('swarm_version')) {
    return 'swarmui';
  }

  // Check for Version field
  const versionMatch = text.match(/Version:\s*([^\s,]+)/);
  if (versionMatch) {
    const version = versionMatch[1];
    if (version === 'neo' || version?.startsWith('neo')) {
      return 'forge-neo';
    }
    if (version?.startsWith('f') && /^f\d/.test(version)) {
      return 'forge';
    }
    if (version === 'ComfyUI') {
      return 'comfyui';
    }
  }

  // SD.Next: has App: SD.Next
  if (text.includes('App: SD.Next') || text.includes('App:SD.Next')) {
    return 'sd-next';
  }

  // Civitai resources
  if (text.includes('Civitai resources:')) {
    return 'civitai';
  }

  // Default to A1111 format if it has typical parameters
  if (text.includes('Steps:') && text.includes('Sampler:')) {
    return 'sd-webui';
  }

  return null;
}
