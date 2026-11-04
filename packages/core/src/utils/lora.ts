import type { LoraSettings } from '../types';
import { parseNumberText, toNumber } from './number';
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
        weight: parseNumberText(unet ?? te),
        clipWeight: separate ? parseNumberText(te) : undefined,
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

// ============================================================================
// Writing
// ============================================================================

/** Extensions A1111 drops when it registers a LoRA file under its stem */
const LORA_EXTENSION = /\.(safetensors|ckpt|pt|bin)$/i;

/** Characters that cannot appear inside an extra-network tag */
const UNTAGGABLE = /[:>]/;

/** CivitAI AIR identifier: `urn:air:<ecosystem>:<type>:civitai:<modelId>@<modelVersionId>` */
const CIVITAI_URN = /^urn:air:[^:]+:[^:]+:civitai:(\d+)@(\d+)$/;

/**
 * Name A1111 looks a LoRA up by: the file name without directory and extension
 *
 * A1111 registers each LoRA file under
 * `os.path.splitext(os.path.basename(filename))[0]`
 * (`extensions-builtin/Lora/networks.py`), so a tag must carry the stem.
 * Names that are not file names (URNs, display names) have neither part and
 * pass through unchanged.
 */
export function toLoraStem(name: string): string {
  const start = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1;
  return name.slice(start).replace(LORA_EXTENSION, '');
}

/**
 * Write a LoRA as an A1111 extra-network tag
 *
 * `<lora:stem:weight>`, or `<lora:stem:clipWeight:weight>` when the
 * text-encoder strength is recorded separately (the positional order of
 * `extra_networks_lora.py`). Without a weight the tag is `<lora:stem>`,
 * which A1111 applies at 1; a clipWeight alone needs the two-value form, so
 * the UNet weight is written as 1 in that case.
 */
export function formatLoraTag(entry: LoraSettings): string {
  const stem = toLoraStem(entry.name);
  if (entry.clipWeight !== undefined) {
    return `<lora:${stem}:${entry.clipWeight}:${entry.weight ?? 1}>`;
  }
  return entry.weight === undefined
    ? `<lora:${stem}>`
    : `<lora:${stem}:${entry.weight}>`;
}

/**
 * Append the tags of the LoRAs a prompt does not mention yet
 *
 * Tags go to the end of the prompt, separated by single spaces. A LoRA whose
 * stem is already tagged (compared the way A1111 matches `Lora hashes`, see
 * `toHashesName`) is left out, so rebuilding A1111 metadata does not double
 * its tags. Names containing `:` or `>` cannot be written as a tag and are
 * skipped; duplicates among the remaining LoRAs are written as often as
 * they are listed.
 *
 * @param prompt - Positive prompt
 * @param loras - LoRAs to mention
 * @returns Prompt with the missing tags appended
 */
export function injectLoraTags(prompt: string, loras: LoraSettings[]): string {
  const present = new Set(
    parseLoraTags(prompt).map((tag) => toMatchKey(tag.name)),
  );
  const tags = loras
    .filter(
      (entry) =>
        !UNTAGGABLE.test(entry.name) && !present.has(toMatchKey(entry.name)),
    )
    .map(formatLoraTag);
  if (tags.length === 0) return prompt;

  const separator = prompt === '' || /\s$/.test(prompt) ? '' : ' ';
  return `${prompt}${separator}${tags.join(' ')}`;
}

/**
 * Build the value of `Lora hashes` the way A1111 writes it
 *
 * `name: hash, …` over the LoRAs that have a hash, each name being the tag
 * stem with `:` and `,` removed (`networks.py` strips both from the
 * mentioned name). A1111 loads a network once however often it is
 * mentioned, so a name listed twice keeps its first hash. The value is
 * returned unquoted.
 *
 * @returns The list, or undefined when no LoRA has a hash
 */
export function formatLoraHashes(loras: LoraSettings[]): string | undefined {
  const hashes = new Map<string, string>();
  for (const entry of loras) {
    const name = toMatchKey(entry.name);
    if (entry.hash && !hashes.has(name)) hashes.set(name, entry.hash);
  }
  if (hashes.size === 0) return undefined;

  return [...hashes].map(([name, hash]) => `${name}: ${hash}`).join(', ');
}

/**
 * Build the `Civitai resources` list of CivitAI's A1111-style text
 *
 * One `{"type":"lora", …}` entry per LoRA: a URN name yields `modelId` and
 * `modelVersionId`, any other name is written as `modelName` (the key
 * CivitAI uses for the display name). `weight` is included when known;
 * the list has no place for a clipWeight.
 *
 * @returns The JSON list, or undefined without LoRAs
 */
export function formatCivitaiResources(
  loras: LoraSettings[],
): string | undefined {
  if (loras.length === 0) return undefined;

  return JSON.stringify(
    loras.map((entry) => {
      const urn = CIVITAI_URN.exec(entry.name);
      return {
        type: 'lora',
        ...(entry.weight === undefined ? {} : { weight: entry.weight }),
        ...(urn
          ? { modelId: Number(urn[1]), modelVersionId: Number(urn[2]) }
          : { modelName: entry.name }),
      };
    }),
  );
}

/**
 * Key two mentions of the same LoRA share: the stem as written into `Lora hashes`
 */
function toMatchKey(name: string): string {
  return toHashesName(toLoraStem(name));
}

/** A LoRA weight written as a number or as text; see {@link toNumber}. */
export { toNumber as toWeight };
