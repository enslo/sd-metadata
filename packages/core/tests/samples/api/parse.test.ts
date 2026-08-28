import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { read } from '../../../src/api/read';
import { pngChunksToRecord } from '../../../src/utils/convert';
import { loadSample, PNG_SAMPLES } from '../../helpers/samples';
import { stripTextChunks } from '../../helpers/stealth-images';

/**
 * NovelAI embeds Stealth PNGInfo (stealth_pngcomp) in every PNG it
 * generates: a gzipped JSON payload in the alpha-channel LSBs whose keys
 * mirror the regular tEXt chunks. These tests verify that parse()
 * recovers the full metadata from pixels alone once the text chunks are
 * stripped, as image hosts commonly do.
 */
const NOVELAI_PNG_SAMPLES = PNG_SAMPLES.filter((name) =>
  name.startsWith('novelai-'),
);

describe('parse - NovelAI Stealth PNGInfo samples', () => {
  it('covers all NovelAI PNG samples', () => {
    expect(NOVELAI_PNG_SAMPLES.length).toBeGreaterThan(0);
  });

  describe('recovery after chunk stripping', () => {
    for (const filename of NOVELAI_PNG_SAMPLES) {
      it(`recovers metadata identical to the chunk-based read: ${filename}`, async () => {
        const original = loadSample('png', filename);
        const baseline = read(original);
        expect(baseline.status).toBe('success');

        const stripped = stripTextChunks(original);
        expect(read(stripped).status).toBe('empty');

        const recovered = await parse(stripped);
        expect(recovered.status).toBe('success');
        if (baseline.status !== 'success' || recovered.status !== 'success') {
          return;
        }
        expect(recovered.metadata).toEqual(baseline.metadata);

        // The stealth payload mirrors the original chunks: every
        // recovered entry must match its chunk-based counterpart.
        // (Only the constant Title chunk is absent from the payload.)
        expect(baseline.raw.format).toBe('png');
        expect(recovered.raw.format).toBe('png');
        if (baseline.raw.format !== 'png' || recovered.raw.format !== 'png') {
          return;
        }
        const originalRecord = pngChunksToRecord(baseline.raw.chunks);
        const recoveredRecord = pngChunksToRecord(recovered.raw.chunks);
        for (const [keyword, text] of Object.entries(recoveredRecord)) {
          expect(originalRecord[keyword]).toBe(text);
        }
        expect(recoveredRecord.Comment).toBeDefined();
      });
    }
  });

  it('recovers the full NovelAI parameter set from novelai-full.png', async () => {
    const stripped = stripTextChunks(loadSample('png', 'novelai-full.png'));

    const result = await parse(stripped);

    expect(result.status).toBe('success');
    if (result.status !== 'success') {
      return;
    }
    expect(result.metadata.software).toBe('novelai');
    expect(result.metadata.prompt).toContain('hatsune miku');
    expect(result.metadata.width).toBe(832);
    expect(result.metadata.height).toBe(1216);
    expect(result.metadata.sampling?.seed).toBe(2043807047);
    expect(result.metadata.sampling?.steps).toBe(28);
  });

  it('returns the chunk-based result untouched for intact samples', async () => {
    const original = loadSample('png', 'novelai-full.png');

    expect(await parse(original)).toEqual(read(original));
  });
});
