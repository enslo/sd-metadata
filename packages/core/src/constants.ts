import type { GenerationSoftware, Vendor, VendorInfo } from './types';

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
    dezgo: 'Dezgo',
  });

/**
 * Human-readable company names for each vendor.
 *
 * @example
 * ```typescript
 * import { vendorLabels } from '@enslo/sd-metadata';
 *
 * const result = await parse(imageData);
 * if (result.status === 'vendor') {
 *   console.log(vendorLabels[result.info.vendor]);
 *   // => "OpenAI", "Google", "xAI", ...
 * }
 * ```
 */
export const vendorLabels: Readonly<Record<Vendor, string>> = Object.freeze({
  openai: 'OpenAI',
  google: 'Google',
  xai: 'xAI',
  meta: 'Meta',
  unknown: 'Unknown',
});

/**
 * Service names for product values vendors are known to declare.
 *
 * Keys are matched exactly against {@link VendorInfo.product}. A vendor may
 * declare its service under several names over time (OpenAI wrote
 * `gpt-image` before `ChatGPT`), so all of them map to the service's name.
 */
const PRODUCT_NAMES: Readonly<
  Partial<Record<Vendor, ReadonlyMap<string, string>>>
> = {
  openai: new Map([
    ['gpt-image', 'GPT Image'],
    ['ChatGPT', 'GPT Image'],
    ['Sora', 'Sora'],
  ]),
  xai: new Map([['Grok Imagine', 'Grok Imagine']]),
};

/** Service name assumed when the declaration names no product. */
const DEFAULT_PRODUCTS: Readonly<
  Record<VendorInfo['media'], Readonly<Record<Vendor, string>>>
> = {
  image: {
    openai: 'GPT Image',
    google: 'Gemini',
    xai: 'Grok Imagine',
    meta: 'Muse',
    unknown: vendorLabels.unknown,
  },
  video: {
    openai: 'Sora',
    google: 'Veo',
    xai: 'Grok Imagine',
    meta: 'Muse',
    unknown: vendorLabels.unknown,
  },
};

/**
 * Display name of the AI service that made a vendor image or video.
 *
 * Includes inference, for display only: a known product value is mapped to
 * the service's name, and a missing one falls back to the vendor's main
 * service for the media (images: GPT Image, Gemini, Grok Imagine, Muse;
 * videos: Sora, Veo, Grok Imagine, Muse). A Google image is therefore
 * reported as Gemini, even though Google
 * also signs other AI edits (e.g. Pixel's Magic Editor), and an image made
 * with OpenAI's gpt-image API as GPT Image. An unknown product value is
 * returned as written, also for an unknown vendor, which is `Unknown` only
 * when it names no product. The declared value stays in `info.product`.
 *
 * @example
 * ```typescript
 * import { productLabel, vendorLabels } from '@enslo/sd-metadata';
 *
 * const result = await parse(imageData);
 * if (result.status === 'vendor') {
 *   console.log(`${vendorLabels[result.info.vendor]} ${productLabel(result.info)}`);
 *   // => "OpenAI GPT Image", "Google Gemini", "xAI Grok Imagine", ...
 * }
 * ```
 *
 * @param info - Vendor declaration from a `vendor` parse result
 * @returns Service name to display
 */
export function productLabel(info: VendorInfo): string {
  if (info.product === undefined) {
    return DEFAULT_PRODUCTS[info.media][info.vendor];
  }
  return PRODUCT_NAMES[info.vendor]?.get(info.product) ?? info.product;
}
