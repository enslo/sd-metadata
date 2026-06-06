import type { C2paVendor, GenerationSoftware } from './types';

/**
 * Human-readable display labels for each generation software identifier.
 *
 * @example
 * ```typescript
 * import { softwareLabels } from '@enslo/sd-metadata';
 *
 * const result = read(imageData);
 * if (result.status === 'success') {
 *   console.log(softwareLabels[result.metadata.software]);
 *   // => "NovelAI", "ComfyUI", "Stable Diffusion WebUI", etc.
 * }
 * ```
 */
export const softwareLabels: Readonly<Record<GenerationSoftware, string>> =
  Object.freeze({
    novelai: 'NovelAI',
    comfyui: 'ComfyUI',
    swarmui: 'SwarmUI',
    tensorart: 'TensorArt',
    'stability-matrix': 'Stability Matrix',
    invokeai: 'InvokeAI',
    'sd-webui': 'Stable Diffusion WebUI',
    forge: 'Forge',
    'forge-classic': 'Forge - Classic',
    'forge-neo': 'Forge - Neo',
    reforge: 'reForge',
    'easy-reforge': 'EasyReforge',
    'sd-next': 'SD.Next',
    civitai: 'Civitai',
    'hf-space': 'Hugging Face Space',
    easydiffusion: 'Easy Diffusion',
    fooocus: 'Fooocus',
    'ruined-fooocus': 'Ruined Fooocus',
    'draw-things': 'Draw Things',
  });

/**
 * Human-readable display labels for each C2PA Content Credentials vendor.
 *
 * @example
 * ```typescript
 * import { c2paVendorLabels } from '@enslo/sd-metadata';
 *
 * const result = read(imageData);
 * if (result.status === 'c2pa') {
 *   console.log(c2paVendorLabels[result.c2pa.vendor]);
 *   // => "OpenAI (ChatGPT)", "Google (Gemini)", ...
 * }
 * ```
 */
export const c2paVendorLabels: Readonly<Record<C2paVendor, string>> =
  Object.freeze({
    openai: 'OpenAI (ChatGPT)',
    google: 'Google (Gemini)',
    unknown: 'AI-generated (Content Credentials)',
  });
