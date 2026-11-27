import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMetadata } from '../../../src/parsers';
import { segmentsToRecord } from '../../../src/utils/convert';

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

  it('rejects a saveimage-plus envelope whose prompt is not a graph', () => {
    const result = parseMetadata({
      UserComment: '{"prompt": ["1girl, solo"], "workflow": {}}',
    });

    expect(result.ok).toBe(false);
  });
});

describe('parseMetadata - JSON entries are parsed once', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a ComfyUI graph in a UserComment once from segments to metadata', () => {
    // As ComfyUI save nodes for JPEG/WebP store it: the API prompt and the
    // UI workflow in one JSON object, which can be megabytes of text
    const text = JSON.stringify({
      prompt: {
        3: {
          class_type: 'KSampler',
          inputs: {
            seed: 42,
            steps: 20,
            cfg: 7,
            sampler_name: 'euler_ancestral',
            scheduler: 'normal',
            denoise: 1,
            model: ['4', 0],
            positive: ['6', 0],
            negative: ['7', 0],
            latent_image: ['5', 0],
          },
        },
        4: {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'anything-v5.safetensors' },
        },
        5: {
          class_type: 'EmptyLatentImage',
          inputs: { width: 512, height: 768, batch_size: 1 },
        },
        6: {
          class_type: 'CLIPTextEncode',
          inputs: { text: '1girl, solo', clip: ['4', 1] },
        },
        7: {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'lowres', clip: ['4', 1] },
        },
      },
      workflow: JSON.parse(UI_WORKFLOW),
    });
    const jsonParse = vi.spyOn(JSON, 'parse');

    const result = parseMetadata(
      segmentsToRecord([{ source: { type: 'exifUserComment' }, data: text }]),
    );

    expect(result.ok && result.value.software).toBe('comfyui');
    expect(result.ok && result.value.prompt).toBe('1girl, solo');
    expect(result.ok && result.value.sampling?.steps).toBe(20);
    // Building the record, detecting the software and the parser all read
    // the UserComment; none of them parses it or a part of it again
    expect(jsonParse).toHaveBeenCalledTimes(1);
  });
});
