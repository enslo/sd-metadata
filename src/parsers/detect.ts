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
