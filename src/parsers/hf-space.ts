import type {
  A1111Metadata,
  InternalParseResult,
  MetadataEntry,
} from '../types';
import { Result } from '../types';
import { buildEntryRecord } from '../utils/entries';
import { parseJson } from '../utils/json';

/**
 * HuggingFace Space JSON metadata structure
 */
interface HfSpaceJsonMetadata {
  prompt?: string;
  negative_prompt?: string;
  resolution?: string;
  guidance_scale?: number;
  num_inference_steps?: number;
  style_preset?: string;
  seed?: number;
  sampler?: string;
  Model?: string;
  'Model hash'?: string;
  use_upscaler?: unknown;
}

/**
 * Parse HuggingFace Space metadata from entries
 *
 * HuggingFace Spaces using Gradio + Diffusers store metadata as JSON
 * in the parameters chunk.
 *
 * @param entries - Metadata entries
 * @returns Parsed metadata or error
 */
export function parseHfSpace(entries: MetadataEntry[]): InternalParseResult {
  const entryRecord = buildEntryRecord(entries);

  // Find parameters entry
  const parametersText = entryRecord.parameters;
  if (!parametersText) {
    return Result.error({ type: 'unsupportedFormat' });
  }

  // Parse JSON
  const parsed = parseJson<HfSpaceJsonMetadata>(parametersText);
  if (!parsed.ok) {
    return Result.error({
      type: 'parseError',
      message: 'Invalid JSON in parameters entry',
    });
  }
  const json = parsed.value;

  // Parse resolution (format: "832 x 1216")
  const parseResolution = (res?: string) => {
    const match = res?.match(/(\d+)\s*x\s*(\d+)/);
    return match?.[1] && match?.[2]
      ? {
          width: Number.parseInt(match[1], 10),
          height: Number.parseInt(match[2], 10),
        }
      : { width: 0, height: 0 };
  };
  const { width, height } = parseResolution(json.resolution);

  // Build metadata
  const metadata: Omit<A1111Metadata, 'raw'> = {
    type: 'a1111',
    software: 'hf-space',
    prompt: json.prompt ?? '',
    negativePrompt: json.negative_prompt ?? '',
    width,
    height,
    model: {
      name: json.Model,
      hash: json['Model hash'],
    },
    sampling: {
      sampler: json.sampler,
      steps: json.num_inference_steps,
      cfg: json.guidance_scale,
      seed: json.seed,
    },
  };

  return Result.ok(metadata);
}
