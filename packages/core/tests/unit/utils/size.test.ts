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
