/**
 * ComfyUI prompt text extraction
 *
 * Follows the conditioning wired into a sampler back to the nodes that hold
 * the prompt text.
 */

import type { ComfyNode, ComfyNodeGraph } from '../types';
import {
  isNodeReference,
  resolveBooleanInput,
  resolveNode,
} from './comfyui-graph';

// =============================================================================
// Text Extraction
// =============================================================================

/**
 * Extract text from a node, following references if needed
 *
 * Handles various text input patterns:
 * - CLIPTextEncode: inputs.text
 * - Power Prompt (rgthree): inputs.prompt
 * - DF_Text_Box (ComfyRoll): inputs.Text
 * - Reference chains: [nodeId, outputIndex] -> trace to source
 */
function extractText(
  nodes: ComfyNodeGraph,
  nodeId: string,
  maxDepth = 10,
): string {
  if (maxDepth <= 0) return '';

  const node = nodes[nodeId];
  if (!node) return '';

  // TextGenerate (comfy-core LLM prompt enhancer): its output text is
  // produced at runtime and never persisted in metadata, and its `prompt`
  // input holds the LLM instruction (system prompt), not the generation
  // prompt. Treated as opaque so ComfySwitchNode traversal falls back to
  // the branch carrying the user's original input.
  if (node.class_type === 'TextGenerate') return '';

  // ComfySwitchNode (comfy-core If/Else): forwards one of two branches
  // selected by a boolean `switch` input. Follow the selected branch first;
  // when it yields no text (e.g. it ends at a runtime-only TextGenerate),
  // fall back to the other branch.
  if (node.class_type === 'ComfySwitchNode') {
    const selected = resolveBooleanInput(nodes, node.inputs.switch) !== false;
    const branches = selected
      ? [node.inputs.on_true, node.inputs.on_false]
      : [node.inputs.on_false, node.inputs.on_true];
    for (const branch of branches) {
      if (typeof branch === 'string' && branch) return branch;
      if (isNodeReference(branch)) {
        const text = extractText(nodes, String(branch[0]), maxDepth - 1);
        if (text) return text;
      }
    }
    return '';
  }

  // PreviewAny (comfy-core): display node that passes `source` through.
  if (node.class_type === 'PreviewAny') {
    const source = node.inputs.source;
    if (typeof source === 'string') return source;
    if (isNodeReference(source)) {
      return extractText(nodes, String(source[0]), maxDepth - 1);
    }
    return '';
  }

  // Common text input names across CLIPTextEncode variants, Power Prompt
  // (rgthree, inputs.prompt), ComfyRoll text boxes (inputs.Text) and
  // PromptStashSaver (inputs.prompt_text — a user-provided string stored on
  // the node itself, treated the same as a direct text input).
  // ImpactWildcardProcessor / ImpactWildcardEncode (ComfyUI-Impact-Pack)
  // keep the template in wildcard_text and the expanded text the run used
  // in populated_text; in "populate" mode the stored value may be the
  // previous run's, the closest record there is.
  // PrimitiveString / PrimitiveStringMultiline (comfy-core) hold their
  // literal in `value`.
  const textValue =
    node.inputs.text ??
    node.inputs.prompt ??
    node.inputs.Text ??
    node.inputs.prompt_text ??
    node.inputs.populated_text ??
    (node.class_type.startsWith('PrimitiveString')
      ? node.inputs.value
      : undefined);

  if (typeof textValue === 'string') {
    return textValue;
  }

  // Reference: try to follow the chain.
  if (isNodeReference(textValue)) {
    const upstream = extractText(nodes, String(textValue[0]), maxDepth - 1);
    if (upstream) return upstream;
    // Fall through to the text_0 cache below — happens when the reference
    // chain ends at a node we cannot introspect (e.g. CR Combine Prompt).
  }

  // ShowText|pysssss (pythongosssss/ComfyUI-Custom-Scripts) caches the
  // composed final text in text_0. Used as a last resort so a regular
  // CLIPTextEncode with a literal text input still wins above.
  if (typeof node.inputs.text_0 === 'string') {
    return node.inputs.text_0;
  }

  return '';
}

// =============================================================================
// Prompt Extraction
// =============================================================================

/**
 * Resolve the node that holds positive/negative conditioning references
 *
 * KSampler/KSamplerAdvanced have positive/negative directly.
 * SamplerCustomAdvanced routes through a guider node (e.g. CFGGuider).
 * Pipe samplers (ImpactKSamplerBasicPipe) take both sides bundled in a pipe
 * input (basic_pipe, detailer_pipe, pipe) built by a node such as
 * ToBasicPipe; the walk hops along pipe inputs until a node names the sides.
 */
function resolveConditioningSource(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode,
): ComfyNode {
  const guiderNode = resolveNode(nodes, sampler.inputs.guider);
  if (guiderNode) return guiderNode;

  let node = sampler;
  for (let hop = 0; hop < 5 && node.inputs.positive === undefined; hop++) {
    const pipe = resolveNode(nodes, pipeInput(node));
    if (!pipe) break;
    node = pipe;
  }
  return node;
}

/**
 * The positive/negative conditioning inputs feeding a sampler
 *
 * BasicGuider (comfy-core, used by Flux and video templates) takes a single
 * `conditioning` input and runs without a negative side, so it reports
 * `negativeless`: an empty negative prompt is the answer, not a gap.
 */
function conditioningInputs(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode,
): { positive: unknown; negative: unknown; negativeless: boolean } {
  const source = resolveConditioningSource(nodes, sampler);
  if (source.class_type === 'BasicGuider') {
    return {
      positive: source.inputs.conditioning,
      negative: undefined,
      negativeless: true,
    };
  }
  return {
    positive: source.inputs.positive,
    negative: source.inputs.negative,
    negativeless: false,
  };
}

/**
 * The first pipe input of a node (`pipe` or `*_pipe`), if any
 */
function pipeInput(node: ComfyNode): unknown {
  return Object.entries(node.inputs).find(
    ([key]) => key === 'pipe' || key.endsWith('_pipe'),
  )?.[1];
}

/**
 * Extract prompt texts by tracing from sampler's positive/negative inputs
 *
 * @param nodes - Full node graph (needed for reference following)
 * @param sampler - Pre-classified sampler node
 */
export function extractPromptTexts(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode | undefined,
): {
  promptText: string;
  negativeText: string;
} {
  if (!sampler) {
    return { promptText: '', negativeText: '' };
  }

  // Resolve the node that holds positive/negative conditioning references.
  // KSampler/KSamplerAdvanced: directly on sampler inputs
  // SamplerCustomAdvanced: on the guider node (CFGGuider, BasicGuider)
  const { positive, negative } = conditioningInputs(nodes, sampler);

  return {
    promptText: extractTextFromConditioning(nodes, positive, 'positive'),
    // Both sides on one output: the negative conditioning is the positive
    // one, which CFG cancels out, so the graph runs without a negative prompt
    negativeText: isSameReference(positive, negative)
      ? ''
      : extractTextFromConditioning(nodes, negative, 'negative'),
  };
}

/**
 * Which conditioning sides the sampler wires to another node
 *
 * A wired side is authoritative: its text is whatever the wire leads to,
 * possibly nothing readable. So is the missing negative side of a guider
 * that has none (BasicGuider). Only an unwired side may be filled from the
 * flat scan.
 */
export function wiredConditioning(
  nodes: ComfyNodeGraph,
  sampler: ComfyNode | undefined,
): { positive: boolean; negative: boolean } {
  if (!sampler) return { positive: false, negative: false };
  const { positive, negative, negativeless } = conditioningInputs(
    nodes,
    sampler,
  );
  return {
    positive: isNodeReference(positive),
    negative: negativeless || isNodeReference(negative),
  };
}

/**
 * Whether two inputs reference the same output of the same node
 */
function isSameReference(a: unknown, b: unknown): boolean {
  return (
    isNodeReference(a) &&
    isNodeReference(b) &&
    String(a[0]) === String(b[0]) &&
    a[1] === b[1]
  );
}

/**
 * Extract text by following a conditioning chain
 *
 * The node a wire leads to may name the side itself: encoders that output
 * both conditionings (TextEncodeQwenImage21: `prompt` / `negative_prompt`)
 * and all-in-one loaders (Efficient Loader, easy fullLoader: `positive` /
 * `negative` strings). That input wins over the generic text inputs, so the
 * negative side never reads the positive prompt, and an empty string is a
 * valid answer. Otherwise the node's own text is used; when it has none the
 * chain continues through the same side (ControlNetApplyAdvanced) and then
 * through `conditioning*` inputs (ControlNetApply, ConditioningCombine,
 * ConditioningConcat, ...), first branch with text wins.
 *
 * A node is searched once per depth budget: nodes that combine several
 * conditionings fan in on the same upstream nodes, and without the memo
 * every route through them would be walked, exponential in the length of
 * the chain.
 */
function extractTextFromConditioning(
  nodes: ComfyNodeGraph,
  ref: unknown,
  condKey: 'positive' | 'negative',
  maxDepth = 10,
  visited: Map<string, number> = new Map(),
): string {
  if (maxDepth <= 0 || !isNodeReference(ref)) return '';

  const nodeId = String(ref[0]);
  // Already searched with at least this much depth to spare, nothing new
  // can be found; a visit with more depth left searches again
  if ((visited.get(nodeId) ?? -1) >= maxDepth) return '';
  visited.set(nodeId, maxDepth);

  const node = nodes[nodeId];
  if (!node) return '';

  // ConditioningZeroOut (comfy-core) discards the text it receives, so the
  // side it feeds runs without a prompt
  if (node.class_type === 'ConditioningZeroOut') return '';

  const own = node.inputs[`${condKey}_prompt`] ?? node.inputs[condKey];
  if (typeof own === 'string') return own;

  const text = extractText(nodes, nodeId);
  if (text) return text;

  const upstream = [
    own,
    ...Object.entries(node.inputs)
      .filter(
        ([key]) => key === 'conditioning' || key.startsWith('conditioning_'),
      )
      .map(([, value]) => value),
  ];
  for (const next of upstream) {
    const found = extractTextFromConditioning(
      nodes,
      next,
      condKey,
      maxDepth - 1,
      visited,
    );
    if (found) return found;
  }
  return '';
}
