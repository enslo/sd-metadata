import { describe, expect, it } from 'vitest';
import { parseSize } from '../../../src/utils/size';

describe('parseSize', () => {
  it('reads "<width>x<height>"', () => {
    expect(parseSize('512x768')).toEqual({ width: 512, height: 768 });
    expect(parseSize('1024x1536')).toEqual({ width: 1024, height: 1536 });
  });

  it('yields zeros for anything else', () => {
    expect(parseSize('')).toEqual({ width: 0, height: 0 });
    expect(parseSize('0x0')).toEqual({ width: 0, height: 0 });
    expect(parseSize('portrait')).toEqual({ width: 0, height: 0 });
    expect(parseSize(undefined)).toEqual({ width: 0, height: 0 });
    expect(parseSize(512)).toEqual({ width: 0, height: 0 });
  });
});

describe('parseSize - long inputs', () => {
  it('gives up in linear time on a long run of digits without an "x"', () => {
    // The unanchored /(\d+)x(\d+)/ was retried from every digit
    expect(parseSize('1'.repeat(200_000))).toEqual({ width: 0, height: 0 });
  });

  it('still reads a size embedded in other text', () => {
    expect(parseSize('Size: 512x768 (hires)')).toEqual({
      width: 512,
      height: 768,
    });
  });
});
