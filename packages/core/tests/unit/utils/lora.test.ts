import { describe, expect, it } from 'vitest';
import {
  formatCivitaiResources,
  formatLoraHashes,
  formatLoraTag,
  injectLoraTags,
  parseLoraTags,
  parseNameValueList,
  toHashesName,
  toLoraStem,
  withLoraHashes,
} from '../../../src/utils/lora';

describe('parseLoraTags', () => {
  it('should read a single weight as the UNet weight', () => {
    expect(parseLoraTags('1girl <lora:LECO_GoodHands:-0.8> smile')).toEqual([
      { name: 'LECO_GoodHands', weight: -0.8 },
    ]);
  });

  it('should read two weights as text encoder then UNet (A1111 order)', () => {
    // extra_networks_lora.py: positional[1] = te_multiplier, positional[2] = unet_multiplier
    expect(parseLoraTags('<lora:Smooth_Booster_v5:0.1:0.5>')).toEqual([
      { name: 'Smooth_Booster_v5', weight: 0.5, clipWeight: 0.1 },
    ]);
  });

  it('should honour te= and unet= named arguments', () => {
    expect(parseLoraTags('<lora:a:te=0.2:unet=0.7>')).toEqual([
      { name: 'a', weight: 0.7, clipWeight: 0.2 },
    ]);
    // A single named weight applies to both, like a single positional one
    expect(parseLoraTags('<lora:a:unet=0.7>')).toEqual([
      { name: 'a', weight: 0.7 },
    ]);
    expect(parseLoraTags('<lora:a:te=0.3>')).toEqual([
      { name: 'a', weight: 0.3 },
    ]);
    // Other named arguments are ignored
    expect(parseLoraTags('<lora:a:0.6:dyn=128>')).toEqual([
      { name: 'a', weight: 0.6 },
    ]);
  });

  it('should keep the order and duplicates of the prompt', () => {
    expect(
      parseLoraTags('<lora:b:0.5> text <lora:a:1> more <lora:b:0.5>'),
    ).toEqual([
      { name: 'b', weight: 0.5 },
      { name: 'a', weight: 1 },
      { name: 'b', weight: 0.5 },
    ]);
  });

  it('should accept lyco tags and ignore other extra networks', () => {
    expect(
      parseLoraTags('<lyco:style:0.4> <hypernet:hn:1> <LORA:upper:0.2>'),
    ).toEqual([
      { name: 'style', weight: 0.4 },
      { name: 'upper', weight: 0.2 },
    ]);
  });

  it('should keep commas in the name', () => {
    expect(parseLoraTags('<lora:Smooth,Booster_v3:1>')).toEqual([
      { name: 'Smooth,Booster_v3', weight: 1 },
    ]);
  });

  it('should leave out weights that are not numbers and skip empty names', () => {
    expect(
      parseLoraTags('<lora:a> <lora:b:> <lora:c:abc> <lora::0.5>'),
    ).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
  });

  it('should return an empty list without tags', () => {
    expect(parseLoraTags('1girl, solo')).toEqual([]);
  });
});

describe('parseNameValueList', () => {
  it('should split "name: value" entries on commas', () => {
    expect(
      parseNameValueList(
        'LECO_GoodHands: fe3806374a03, LECO_BadHands: 37c8880f409c',
      ),
    ).toEqual([
      ['LECO_GoodHands', 'fe3806374a03'],
      ['LECO_BadHands', '37c8880f409c'],
    ]);
  });

  it('should skip entries without a colon, name or value', () => {
    expect(parseNameValueList('a: 1, broken, : 2, b:, c: 3')).toEqual([
      ['a', '1'],
      ['c', '3'],
    ]);
    expect(parseNameValueList(undefined)).toEqual([]);
    expect(parseNameValueList('')).toEqual([]);
  });
});

describe('withLoraHashes', () => {
  it('should attach hashes by name', () => {
    const loras = parseLoraTags('<lora:a:0.5> <lora:b:1>');

    expect(withLoraHashes(loras, 'a: 1111111111, b: 2222222222')).toEqual([
      { name: 'a', weight: 0.5, hash: '1111111111' },
      { name: 'b', weight: 1, hash: '2222222222' },
    ]);
  });

  it('should match names the way A1111 writes them (colons and commas removed)', () => {
    expect(toHashesName('Smooth,Booster_v3')).toBe('SmoothBooster_v3');

    const loras = parseLoraTags('<lora:Smooth,Booster_v3:1>');

    expect(withLoraHashes(loras, 'SmoothBooster_v3: 61d7ee6c08bd')).toEqual([
      { name: 'Smooth,Booster_v3', weight: 1, hash: '61d7ee6c08bd' },
    ]);
  });

  it('should leave LoRAs without a matching hash untouched', () => {
    const loras = parseLoraTags('<lora:a:0.5>');

    expect(withLoraHashes(loras, 'other: 1234567890')).toEqual([
      { name: 'a', weight: 0.5 },
    ]);
    expect(withLoraHashes(loras, undefined)).toEqual([
      { name: 'a', weight: 0.5 },
    ]);
  });
});

describe('toLoraStem', () => {
  it('should drop the directory and the extension', () => {
    expect(toLoraStem('Lora\\LECO_GoodHands.safetensors')).toBe(
      'LECO_GoodHands',
    );
    expect(toLoraStem('styles/anime/foo.ckpt')).toBe('foo');
    expect(toLoraStem('foo.PT')).toBe('foo');
    expect(toLoraStem('foo.bin')).toBe('foo');
  });

  it('should keep names that are not file names', () => {
    const urn = 'urn:air:sdxl:lora:civitai:1547435@1750914';
    expect(toLoraStem(urn)).toBe(urn);
    expect(toLoraStem('Detailed anime style - Illustrious V2.0')).toBe(
      'Detailed anime style - Illustrious V2.0',
    );
    expect(toLoraStem('lora.by_tusi')).toBe('lora.by_tusi');
  });
});

describe('formatLoraTag', () => {
  it('should write a single weight', () => {
    expect(formatLoraTag({ name: 'foo.safetensors', weight: -0.8 })).toBe(
      '<lora:foo:-0.8>',
    );
  });

  it('should write clipWeight before weight (A1111 order)', () => {
    expect(formatLoraTag({ name: 'foo', weight: 0.5, clipWeight: 0.1 })).toBe(
      '<lora:foo:0.1:0.5>',
    );
  });

  it('should write only the name without a weight', () => {
    expect(formatLoraTag({ name: 'foo' })).toBe('<lora:foo>');
  });

  it('should write a UNet weight of 1 when only clipWeight is known', () => {
    expect(formatLoraTag({ name: 'foo', clipWeight: 0.3 })).toBe(
      '<lora:foo:0.3:1>',
    );
  });
});

describe('injectLoraTags', () => {
  it('should append tags separated by spaces', () => {
    expect(
      injectLoraTags('1girl, solo', [
        { name: 'a', weight: 0.5 },
        { name: 'b.safetensors', weight: 1, clipWeight: 0.8 },
      ]),
    ).toBe('1girl, solo <lora:a:0.5> <lora:b:0.8:1>');
  });

  it('should add no separator after an empty prompt or trailing whitespace', () => {
    expect(injectLoraTags('', [{ name: 'a', weight: 1 }])).toBe('<lora:a:1>');
    expect(injectLoraTags('1girl, ', [{ name: 'a', weight: 1 }])).toBe(
      '1girl, <lora:a:1>',
    );
    expect(injectLoraTags('1girl\n', [{ name: 'a', weight: 1 }])).toBe(
      '1girl\n<lora:a:1>',
    );
  });

  it('should leave out LoRAs the prompt already tags', () => {
    const prompt =
      '1girl <lora:LECO_GoodHands:-0.8> <lora:Smooth,Booster_v3:1>';
    expect(
      injectLoraTags(prompt, [
        { name: 'LECO_GoodHands', weight: -0.8, hash: 'fe3806374a03' },
        { name: 'Smooth,Booster_v3', weight: 1 },
        { name: 'LECO_BadHands.safetensors', weight: 0.8 },
      ]),
    ).toBe(`${prompt} <lora:LECO_BadHands:0.8>`);
  });

  it('should match existing tags by stem, the way Lora hashes are matched', () => {
    expect(
      injectLoraTags('<lora:foo:1>', [
        { name: 'Lora\\foo.safetensors', weight: 1 },
      ]),
    ).toBe('<lora:foo:1>');
    expect(injectLoraTags('<lora:a,b:1>', [{ name: 'a,b', weight: 1 }])).toBe(
      '<lora:a,b:1>',
    );
  });

  it('should skip names that cannot be written as a tag', () => {
    expect(
      injectLoraTags('1girl', [
        { name: 'urn:air:sdxl:lora:civitai:1@2', weight: 1 },
        { name: 'a>b', weight: 1 },
        { name: 'ok', weight: 1 },
      ]),
    ).toBe('1girl <lora:ok:1>');
  });

  it('should write duplicates as often as they are listed', () => {
    expect(
      injectLoraTags('1girl', [
        { name: 'a', weight: 1 },
        { name: 'a', weight: 0.5 },
      ]),
    ).toBe('1girl <lora:a:1> <lora:a:0.5>');
  });

  it('should return the prompt unchanged without LoRAs', () => {
    expect(injectLoraTags('1girl', [])).toBe('1girl');
  });
});

describe('formatLoraHashes', () => {
  it('should list the hashed LoRAs by stem', () => {
    expect(
      formatLoraHashes([
        { name: 'Lora\\a.safetensors', weight: 1, hash: 'h1' },
        { name: 'b', weight: 1 },
        { name: 'c', weight: 1, hash: 'blake3:h3' },
      ]),
    ).toBe('a: h1, c: blake3:h3');
  });

  it('should strip colons and commas from the name like A1111', () => {
    expect(
      formatLoraHashes([
        { name: 'Smooth,Booster_v3', weight: 1, hash: '61d7ee6c08bd' },
      ]),
    ).toBe('SmoothBooster_v3: 61d7ee6c08bd');
  });

  it('should keep the first hash of a name listed twice', () => {
    expect(
      formatLoraHashes([
        { name: 'a', hash: 'h1' },
        { name: 'a', hash: 'h2' },
      ]),
    ).toBe('a: h1');
  });

  it('should return undefined when no LoRA has a hash', () => {
    expect(formatLoraHashes([{ name: 'a', weight: 1 }])).toBeUndefined();
    expect(formatLoraHashes([])).toBeUndefined();
  });
});

describe('formatCivitaiResources', () => {
  it('should take modelId and modelVersionId from a URN', () => {
    expect(
      formatCivitaiResources([
        {
          name: 'urn:air:sdxl:lora:civitai:1547435@1750914',
          weight: 0.4,
          clipWeight: 1,
        },
      ]),
    ).toBe(
      '[{"type":"lora","weight":0.4,"modelId":1547435,"modelVersionId":1750914}]',
    );
  });

  it('should write other names as modelName', () => {
    expect(
      formatCivitaiResources([
        { name: 'Detailed anime style - Illustrious V2.0', weight: 0.4 },
      ]),
    ).toBe(
      '[{"type":"lora","weight":0.4,"modelName":"Detailed anime style - Illustrious V2.0"}]',
    );
  });

  it('should leave out an unknown weight', () => {
    expect(
      formatCivitaiResources([{ name: 'urn:air:sd1:lora:civitai:1@2' }]),
    ).toBe('[{"type":"lora","modelId":1,"modelVersionId":2}]');
  });

  it('should return undefined without LoRAs', () => {
    expect(formatCivitaiResources([])).toBeUndefined();
  });
});
