import type { LoraSettings } from '../types';
import { trimObject } from './object';

/**
 * Extra-network tag as A1111 matches it: `<type:args>`
 *
 * Same regular expression as AUTOMATIC1111's `extra_networks.py`; the args
 * are split on `:` afterwards, so a name may contain commas but not colons.
 */
const TAG_PATTERN = /<(\w+):([^>]+)>/g;

/** Tag types read as LoRA; LyCORIS shares the syntax */
const LORA_TAG_TYPES = new Set(['lora', 'lyco']);

/**
 * Parse the LoRA tags of a prompt
 *
 * `<lora:name:w>` applies `w` to both the UNet and the text encoder, so it
 * becomes `weight` alone. `<lora:name:te:unet>` lists the text-encoder
 * multiplier first (A1111 `extra_networks_lora.py` positional order), so it
 * becomes `clipWeight` + `weight`. The named forms `te=` / `unet=` follow
 * the same assignment; other named args (`dyn=`) are ignored. Weights that
 * are not numbers are left out, tags without a name are skipped.
 *
 * Call this with the positive prompt only: A1111 does not apply extra
 * networks from the negative prompt.
 *
 * @param prompt - Prompt text
 * @returns LoRAs in order of appearance (duplicates kept)
 */
export function parseLoraTags(prompt: string): LoraSettings[] {
  const loras: LoraSettings[] = [];

  for (const match of prompt.matchAll(TAG_PATTERN)) {
    if (!LORA_TAG_TYPES.has((match[1] ?? '').toLowerCase())) continue;

    const [rawName = '', ...args] = (match[2] ?? '').split(':');
    const name = rawName.trim();
    if (name === '') continue;

    const positional: string[] = [];
    const named = new Map<string, string>();
    for (const arg of args) {
      const eq = arg.indexOf('=');
      if (eq > 0) named.set(arg.slice(0, eq).trim(), arg.slice(eq + 1));
      else positional.push(arg);
    }

    const te = named.get('te') ?? positional[0];
    const unet = named.get('unet') ?? positional[1];
    const separate = te !== undefined && unet !== undefined;

    loras.push(
      lora({
        name,
        weight: parseWeight(unet ?? te),
        clipWeight: separate ? parseWeight(te) : undefined,
      }),
    );
  }

  return loras;
}

/**
 * Split a `name: value, name: value` list
 *
 * The format A1111 uses for `Lora hashes` and Fooocus for `Lora weights`.
 * Entries without a colon, name or value are skipped.
 *
 * @param text - List text (already unquoted)
 * @returns Name/value pairs in order
 */
export function parseNameValueList(
  text: string | undefined,
): Array<[string, string]> {
  if (!text) return [];

  return text.split(',').flatMap((entry) => {
    const colon = entry.indexOf(':');
    if (colon < 0) return [];
    const name = entry.slice(0, colon).trim();
    const value = entry.slice(colon + 1).trim();
    return name && value ? [[name, value] as [string, string]] : [];
  });
}

/**
 * Name as A1111 writes it into `Lora hashes`
 *
 * A1111 strips `:` and `,` from the mentioned name before writing the list,
 * so tag names must be compared after the same stripping.
 */
export function toHashesName(name: string): string {
  return name.replace(/[:,]/g, '');
}

/**
 * Attach the hashes of a `Lora hashes` list to LoRAs by name
 *
 * @param loras - LoRAs read from tags or another list
 * @param hashesText - Value of `Lora hashes` (unquoted), if any
 * @returns LoRAs with `hash` set where a name matched
 */
export function withLoraHashes(
  loras: LoraSettings[],
  hashesText: string | undefined,
): LoraSettings[] {
  const hashes = new Map(parseNameValueList(hashesText));
  if (hashes.size === 0) return loras;

  return loras.map((entry) => {
    const hash = hashes.get(toHashesName(entry.name));
    return hash ? { ...entry, hash } : entry;
  });
}

/**
 * Build a LoraSettings without undefined fields
 */
export function lora(fields: {
  name: string;
  weight?: number;
  clipWeight?: number;
  hash?: string;
}): LoraSettings {
  // name is always present, so trimObject never yields undefined here
  return trimObject(fields) as LoraSettings;
}

/**
 * Parse a weight written as text; blank or non-numeric text yields undefined
 */
function parseWeight(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Read a weight written as a number or as text
 *
 * JSON tools write numbers; SwarmUI, RuinedFooocus and Easy Diffusion PNG
 * chunks write text. Anything else, blank text or a non-finite value yields
 * undefined.
 */
export function toWeight(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  return typeof value === 'string' ? parseWeight(value) : undefined;
}

/**
 * Spread helper that adds `loras` only when at least one LoRA was read
 *
 * @example
 * Result.ok({ software, prompt, ...optionalLoras(loras) })
 */
export function optionalLoras(
  loras: LoraSettings[],
): { loras: LoraSettings[] } | Record<string, never> {
  return loras.length > 0 ? { loras } : {};
}
