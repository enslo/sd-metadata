import { describe, expect, it } from 'vitest';
import { extract } from '../src/extract';

describe('extract - inputs that used to crash or hang', () => {
  it('returns A1111 text that merely mentions sui_image_params as it is', () => {
    const text = 'a photo of sui_image_params, 1girl\nSteps: 20, Seed: 1';
    expect(extract({ parameters: text })).toBe(text);
  });

  it('does not throw on SwarmUI JSON with trailing garbage', () => {
    const text = '{"sui_image_params":{"prompt":"1girl"}}x';
    expect(() => extract({ parameters: text })).not.toThrow();
  });

  it('strips NUL padding from a ComfyUI prompt chunk in linear time', () => {
    const graph =
      '{"1":{"class_type":"CLIPTextEncode","inputs":{"text":"1girl"}}}';
    expect(extract({ prompt: `${graph}${'\0'.repeat(200_000)}` })).toContain(
      '1girl',
    );
    // A byte after the NULs made /\0+$/ retry from every NUL
    expect(() =>
      extract({ prompt: `${graph}${'\0'.repeat(200_000)}x` }),
    ).not.toThrow();
  });

  it('strips NUL padding from a channelled generation_data chunk in linear time', () => {
    const data = `{"prompt":"1girl"}${'\0'.repeat(200_000)}x`;
    expect(() => extract({ generation_data: data })).not.toThrow();
  });

  it('gives up on a Fooocus resolution of digits only in linear time', () => {
    const text = JSON.stringify({
      Model: 'm',
      resolution: '1'.repeat(200_000),
    });
    expect(extract({ parameters: text })).not.toContain('Size:');
  });
});
