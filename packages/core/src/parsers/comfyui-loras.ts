import type { ComfyNode, ComfyNodeGraph, LoraSettings } from '../types';
import { lora, parseLoraTags, toWeight } from '../utils/lora';

/**
 * LoRA loader nodes
 *
 * Reads the LoRAs a ComfyUI graph applies, one rule per loader `class_type`
 * (input names as the nodes write them to the API prompt). A LoRA is listed
 * only when the node applies it: slots switched off or left at "None",
 * entries beyond a stack's count and switcher slots other than the selected
 * one are skipped. Nodes not in the table are ignored; in particular a
 * `<lora:...>` tag inside CLIPTextEncode text is not read, because plain
 * ComfyUI does not interpret it. Order is graph key order, then slot order;
 * duplicates are kept.
 */

type Inputs = ComfyNode['inputs'];

/** Value stack nodes write for an empty slot */
const NO_LORA = 'None';

/**
 * Plain-object check for nested input values
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accept a LoRA file name; empty, "None" and node references are not names
 */
function nameOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' && value !== NO_LORA
    ? value
    : undefined;
}

/**
 * One LoRA from a name and its strengths; nothing when the name is unset
 *
 * A strength that is a node reference (wired from another node) is left out
 * rather than resolved.
 */
function entry(
  name: unknown,
  weight: unknown,
  clipWeight?: unknown,
): LoraSettings[] {
  const resolved = nameOf(name);
  if (!resolved) return [];
  return [
    lora({
      name: resolved,
      weight: toWeight(weight),
      clipWeight: toWeight(clipWeight),
    }),
  ];
}

/**
 * Reader for a loader with a single LoRA under fixed input names
 */
function single(name: string, weight: string, clip?: string) {
  return (inputs: Inputs): LoraSettings[] =>
    entry(inputs[name], inputs[weight], clip ? inputs[clip] : undefined);
}

/**
 * Slot numbers present in the inputs, in ascending order
 *
 * @param pattern - Key pattern with the slot number as its first group
 */
function slotNumbers(inputs: Inputs, pattern: RegExp): number[] {
  return Object.keys(inputs)
    .map((key) => Number(key.match(pattern)?.[1]))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
}

/**
 * Slot numbers up to a stack's count input (`lora_count`, `num_loras`)
 */
function countedSlots(
  inputs: Inputs,
  count: unknown,
  pattern: RegExp,
): number[] {
  const limit = typeof count === 'number' ? count : 0;
  return slotNumbers(inputs, pattern).filter((n) => n <= limit);
}

/**
 * LoRAs from A1111-style tags in a text input
 */
function tags(value: unknown): LoraSettings[] {
  return typeof value === 'string' ? parseLoraTags(value) : [];
}

/**
 * Loader rules by class_type
 */
const READERS: Record<string, (inputs: Inputs) => LoraSettings[]> = {
  // ComfyUI core; CivitAI and Stability Matrix chain these too
  LoraLoader: single('lora_name', 'strength_model', 'strength_clip'),
  LoraLoaderModelOnly: single('lora_name', 'strength_model'),

  // ComfyUI_Comfyroll_CustomNodes: three slots, each with an On/Off switch
  'CR LoRA Stack': (inputs) =>
    slotNumbers(inputs, /^lora_name_(\d+)$/).flatMap((n) =>
      inputs[`switch_${n}`] === 'On'
        ? entry(
            inputs[`lora_name_${n}`],
            inputs[`model_weight_${n}`],
            inputs[`clip_weight_${n}`],
          )
        : [],
    ),

  // rgthree-comfy: one object per slot with an on/off flag; the header
  // widget and the model/clip links share the inputs object and are skipped.
  // The API prompt carries a single strength (strengthTwo stays in the UI
  // workflow), so there is no clip weight.
  'Power Lora Loader (rgthree)': (inputs) =>
    Object.entries(inputs).flatMap(([key, value]) =>
      /^lora_\d+$/.test(key) && isRecord(value) && value.on === true
        ? entry(value.lora, value.strength)
        : [],
    ),
  'Lora Loader Stack (rgthree)': (inputs) =>
    slotNumbers(inputs, /^lora_(\d+)$/).flatMap((n) => {
      const id = String(n).padStart(2, '0');
      return entry(inputs[`lora_${id}`], inputs[`strength_${id}`]);
    }),
  // The prompt text is also what CLIPTextEncode receives, so the tags stay
  // in metadata.prompt; they are counted here only
  'Power Prompt (rgthree)': (inputs) => tags(inputs.prompt),

  // efficiency-nodes-comfyui: the loader's own slot, plus a stacker whose
  // slots up to lora_count apply; "advanced" mode has separate strengths
  'Efficient Loader': single(
    'lora_name',
    'lora_model_strength',
    'lora_clip_strength',
  ),
  'LoRA Stacker': (inputs) =>
    countedSlots(inputs, inputs.lora_count, /^lora_name_(\d+)$/).flatMap((n) =>
      inputs.input_mode === 'advanced'
        ? entry(
            inputs[`lora_name_${n}`],
            inputs[`model_str_${n}`],
            inputs[`clip_str_${n}`],
          )
        : entry(inputs[`lora_name_${n}`], inputs[`lora_wt_${n}`]),
    ),

  // ComfyUI-Easy-Use: same layout as efficiency-nodes with a toggle that
  // disables the whole node; the switcher applies one selected slot with a
  // shared strength
  'easy fullLoader': single(
    'lora_name',
    'lora_model_strength',
    'lora_clip_strength',
  ),
  'easy loraStack': (inputs) =>
    inputs.toggle === false
      ? []
      : countedSlots(inputs, inputs.num_loras, /^lora_(\d+)_name$/).flatMap(
          (n) =>
            inputs.mode === 'advanced'
              ? entry(
                  inputs[`lora_${n}_name`],
                  inputs[`lora_${n}_model_strength`],
                  inputs[`lora_${n}_clip_strength`],
                )
              : entry(inputs[`lora_${n}_name`], inputs[`lora_${n}_strength`]),
        ),
  'easy loraSwitcher': (inputs) =>
    inputs.toggle === false
      ? []
      : entry(inputs[`lora_${inputs.select}_name`], inputs.lora_strength),

  // ComfyUI-Lora-Manager: the structured list is authoritative; its `text`
  // input repeats every entry as a tag, inactive ones included
  'Lora Loader (LoraManager)': (inputs) =>
    Array.isArray(inputs.loras)
      ? inputs.loras.flatMap((item) =>
          isRecord(item) && item.active === true
            ? entry(item.name, item.strength, item.clipStrength)
            : [],
        )
      : [],

  // TensorArt's loader: a tag list in `text`
  LoraTagLoader: (inputs) => tags(inputs.text),
};

/**
 * Read the LoRAs applied by the loader nodes of a graph
 *
 * @param nodes - API prompt graph
 * @returns LoRAs in graph order; empty when the graph applies none
 */
export function extractComfyLoras(nodes: ComfyNodeGraph): LoraSettings[] {
  return Object.values(nodes).flatMap((node) => {
    const reader = READERS[node?.class_type];
    return reader && isRecord(node.inputs) ? reader(node.inputs) : [];
  });
}
