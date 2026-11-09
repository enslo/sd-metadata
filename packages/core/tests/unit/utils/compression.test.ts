import { deflateSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { gunzip, inflate } from '../../../src/utils/compression';

const MEBIBYTE = 1024 * 1024;

describe('inflate', () => {
  it('inflates a zlib stream that fits the limit', async () => {
    const data = new Uint8Array(MEBIBYTE).fill(7);
    const compressed = new Uint8Array(deflateSync(data));

    expect(await inflate(compressed, MEBIBYTE)).toEqual(data);
  });

  it('rejects a stream that inflates past the limit instead of buffering it', async () => {
    // 4 MiB of zeros deflate to a few KiB; the limit stops the expansion
    const compressed = new Uint8Array(
      deflateSync(new Uint8Array(4 * MEBIBYTE)),
    );

    await expect(inflate(compressed, MEBIBYTE)).rejects.toThrow(RangeError);
  });

  it('rejects data that is not a zlib stream', async () => {
    await expect(
      inflate(new Uint8Array([1, 2, 3]), MEBIBYTE),
    ).rejects.toThrow();
  });
});

describe('gunzip', () => {
  it('inflates a gzip stream that fits the limit', async () => {
    const data = new TextEncoder().encode('{"Comment":"1girl"}');
    const compressed = new Uint8Array(gzipSync(data));

    expect(await gunzip(compressed, MEBIBYTE)).toEqual(data);
  });

  it('rejects a stream that inflates past the limit', async () => {
    const compressed = new Uint8Array(gzipSync(new Uint8Array(4 * MEBIBYTE)));

    await expect(gunzip(compressed, MEBIBYTE)).rejects.toThrow(RangeError);
  });
});
