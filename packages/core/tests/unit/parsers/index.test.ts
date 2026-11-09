import { describe, expect, it } from 'vitest';
import { parseMetadata } from '../../../src/parsers';

const A1111_TEXT = [
  '1girl, solo',
  'Negative prompt: lowres',
  'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 42, Size: 512x768, Model: anything-v5',
].join('\n');

/** The UI-state workflow JSON, which carries no API prompt graph */
const UI_WORKFLOW = JSON.stringify({
  last_node_id: 3,
  nodes: [{ id: 1, type: 'CLIPTextEncode', widgets_values: ['1girl, solo'] }],
  links: [],
});

/** A saveimage-plus envelope cut off partway through its graph */
const CUT_OFF_GRAPH =
  '{"prompt": {"1": {"class_type": "KSampler", "inputs": {"seed": 42, "steps": 2';

describe('parseMetadata - ComfyUI and CivitAI fallbacks', () => {
  it('reads the A1111 text of a PNG that carries a workflow but no prompt graph', () => {
    // A ComfyUI save node with prompt embedding off writes parameters + workflow
    const result = parseMetadata({
      parameters: A1111_TEXT,
      workflow: UI_WORKFLOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.software).toBe('sd-webui');
    expect(result.value.prompt).toBe('1girl, solo');
    expect(result.value.sampling?.steps).toBe(20);
  });

  it('keeps the empty ComfyUI result for a workflow that comes alone', () => {
    const result = parseMetadata({ workflow: UI_WORKFLOW });

    expect(result.ok && result.value.software).toBe('comfyui');
    expect(result.ok && result.value.prompt).toBe('');
  });

  it('does not read a cut-off ComfyUI graph as an A1111 prompt', () => {
    const result = parseMetadata({ UserComment: CUT_OFF_GRAPH });

    expect(result.ok).toBe(false);
  });

  it('does not read a cut-off CivitAI graph as an A1111 prompt', () => {
    const result = parseMetadata({
      UserComment: `{"extraMetadata": "{}", ${CUT_OFF_GRAPH.slice(1)}`,
    });

    expect(result.ok).toBe(false);
  });

  it('still reads the A1111 text of a ComfyUI save that wrote only text', () => {
    // comfy-image-saver: A1111 text whose Version names ComfyUI
    const result = parseMetadata({
      UserComment: `${A1111_TEXT}, Version: ComfyUI`,
    });

    expect(result.ok && result.value.software).toBe('sd-webui');
    expect(result.ok && result.value.prompt).toBe('1girl, solo');
  });
});
