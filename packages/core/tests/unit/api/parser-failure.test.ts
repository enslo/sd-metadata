import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { read } from '../../../src/api/read';
import { createStealthPng } from '../../helpers/stealth-images';

/**
 * PNG carrying the given tEXt chunks (the reader does not verify CRCs)
 */
function pngWithText(entries: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks = Object.entries(entries).map(([keyword, text]) => {
    const keywordBytes = encoder.encode(keyword);
    const textBytes = encoder.encode(text);
    const dataLength = keywordBytes.length + 1 + textBytes.length;
    const chunk = new Uint8Array(12 + dataLength);
    new DataView(chunk.buffer).setUint32(0, dataLength);
    chunk.set(encoder.encode('tEXt'), 4);
    chunk.set(keywordBytes, 8);
    chunk.set(textBytes, 9 + keywordBytes.length);
    return chunk;
  });
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const png = new Uint8Array(signature.length + total + iend.length);
  png.set(signature, 0);
  let offset = signature.length;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  png.set(iend, offset);
  return png;
}

/**
 * NovelAI Comment whose V4 char_captions is a string, not a list; the
 * NovelAI parser does not expect that shape
 */
const UNEXPECTED_NOVELAI_COMMENT = JSON.stringify({
  prompt: '1girl, solo',
  uc: 'lowres',
  v4_prompt: {
    caption: { base_caption: '1girl, solo', char_captions: 'oops' },
  },
});

describe('read / parse when a parser trips over the data', () => {
  it('read() reports metadata it cannot interpret as unrecognized instead of throwing', () => {
    const png = pngWithText({
      Software: 'NovelAI',
      Comment: UNEXPECTED_NOVELAI_COMMENT,
    });

    const result = read(png);

    expect(result.status).toBe('unrecognized');
    if (result.status === 'unrecognized' && result.raw.format === 'png') {
      // The raw chunks stay available to the caller
      expect(result.raw.chunks.map((c) => c.keyword)).toEqual([
        'Software',
        'Comment',
      ]);
    }
  });

  it('parse() surfaces a recovered stealth payload a parser trips over as unrecognized', async () => {
    const png = createStealthPng({
      payload: JSON.stringify({
        Software: 'NovelAI',
        Comment: UNEXPECTED_NOVELAI_COMMENT,
      }),
    });

    const result = await parse(png);

    expect(result.status).toBe('unrecognized');
    if (result.status === 'unrecognized') {
      expect(result.stealth).toBe(true);
    }
  });
});
