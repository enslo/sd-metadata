import { describe, expect, it } from 'vitest';
import { softwareLabels } from '../../src/constants';
import type { GenerationSoftware } from '../../src/types';

describe('softwareLabels', () => {
  it('has an entry for every GenerationSoftware value', () => {
    const allSoftware: GenerationSoftware[] = [
      'novelai',
      'comfyui',
      'swarmui',
      'tensorart',
      'stability-matrix',
      'invokeai',
      'forge',
      'forge-classic',
      'forge-neo',
      'reforge',
      'easy-reforge',
      'sd-webui',
      'sd-next',
      'civitai',
      'hf-space',
      'easydiffusion',
      'fooocus',
      'ruined-fooocus',
    ];

    for (const software of allSoftware) {
      expect(softwareLabels[software]).toBeTypeOf('string');
      expect(softwareLabels[software].length).toBeGreaterThan(0);
    }
  });

  it('maps identifiers to human-readable names', () => {
    expect(softwareLabels.novelai).toBe('NovelAI');
    expect(softwareLabels.comfyui).toBe('ComfyUI');
    expect(softwareLabels['sd-webui']).toBe('Stable Diffusion WebUI');
    expect(softwareLabels['hf-space']).toBe('Hugging Face Space');
    expect(softwareLabels.forge).toBe('Forge');
    expect(softwareLabels['forge-classic']).toBe('Forge - Classic');
    expect(softwareLabels['forge-neo']).toBe('Forge - Neo');
    expect(softwareLabels.reforge).toBe('reForge');
    expect(softwareLabels['easy-reforge']).toBe('EasyReforge');
  });

  it('is a frozen object', () => {
    expect(Object.isFrozen(softwareLabels)).toBe(true);
  });
});
