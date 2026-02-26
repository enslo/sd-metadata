import type { GenerationSoftware } from './types';

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
