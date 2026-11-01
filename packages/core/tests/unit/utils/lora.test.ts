import { describe, expect, it } from 'vitest';
import {
  parseLoraTags,
  parseNameValueList,
  toHashesName,
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
