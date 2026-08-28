import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/api/parse';
import { read } from '../../../src/api/read';
import { write } from '../../../src/api/write';
import { pngChunksToRecord } from '../../../src/utils/convert';
import { loadSample, PNG_SAMPLES } from '../../helpers/samples';
import { stripTextChunks } from '../../helpers/stealth-images';

/**
 * Stealth PNGInfo carriers among the samples:
 *
 * - novelai-*: NovelAI embeds stealth_pngcomp (alpha + gzip) in every
 *   PNG, a JSON payload whose keys mirror its tEXt chunks.
 * - forge-stealth-<mode>-<comp|raw>: the sd-webui-stealth-pnginfo
 *   extension on Forge, plain infotext payload. The four files cover
 *   all four variants (alpha/rgb x compressed/uncompressed).
 * - comfyui-stealth-<mode>-<comp|raw>: the comfyui_stealth_pnginfo
 *   custom node, JSON payload with prompt/workflow objects. Also covers
 *   all four variants.
 *
 * These tests verify that parse() recovers the full metadata from
 * pixels alone once the text chunks are stripped, as image hosts
 * commonly do.
 */
const STEALTH_PNG_SAMPLES = PNG_SAMPLES.filter(
  (name) => name.startsWith('novelai-') || name.includes('-stealth-'),
);

const NOVELAI_PNG_SAMPLES = PNG_SAMPLES.filter((name) =>
  name.startsWith('novelai-'),
);

describe('parse - Stealth PNGInfo samples', () => {
  it('covers all stealth-capable PNG samples', () => {
    // 4 NovelAI + 4 Forge variants + 4 ComfyUI variants
    expect(STEALTH_PNG_SAMPLES.length).toBeGreaterThanOrEqual(12);
  });

  describe('recovery after chunk stripping', () => {
    for (const filename of STEALTH_PNG_SAMPLES) {
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
      });
    }
  });

  describe('NovelAI payload mirrors the text chunks', () => {
    for (const filename of NOVELAI_PNG_SAMPLES) {
      it(`every recovered entry matches its chunk counterpart: ${filename}`, async () => {
        const original = loadSample('png', filename);
        const baseline = read(original);
        const recovered = await parse(stripTextChunks(original));
        if (baseline.status !== 'success' || recovered.status !== 'success') {
          expect.fail('both reads should succeed');
        }

        // Only the constant Title chunk is absent from the payload.
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

  it('recovers Forge infotext from an uncompressed alpha payload', async () => {
    const stripped = stripTextChunks(
      loadSample('png', 'forge-stealth-alpha-raw.png'),
    );

    const result = await parse(stripped);

    expect(result.status).toBe('success');
    if (result.status !== 'success') {
      return;
    }
    expect(result.metadata.software).toBe('forge-classic');
    expect(result.metadata.prompt).toContain('masterpiece');
    expect(result.metadata.sampling?.seed).toBe(85111043);
    expect(result.metadata.model?.name).toBe('waiNSFWIllustrious_v140');
  });

  it('recovers the ComfyUI workflow from a stealth JSON payload', async () => {
    const stripped = stripTextChunks(
      loadSample('png', 'comfyui-stealth-alpha-comp.png'),
    );

    const result = await parse(stripped);

    expect(result.status).toBe('success');
    if (result.status !== 'success') {
      return;
    }
    expect(result.metadata.software).toBe('comfyui');
    expect(result.metadata.sampling?.seed).toBe(168422942929213);
    expect(result.metadata.model?.name).toBe(
      'waiNSFWIllustrious_v140.safetensors',
    );

    // The payload's prompt/workflow objects are synthesized back into
    // the chunk layout ComfyUI itself writes.
    expect(result.raw.format).toBe('png');
    if (result.raw.format !== 'png') {
      return;
    }
    const record = pngChunksToRecord(result.raw.chunks);
    expect(() => JSON.parse(record.prompt ?? '')).not.toThrow();
    expect(() => JSON.parse(record.workflow ?? '')).not.toThrow();
  });

  it('returns the chunk-based result untouched for intact samples', async () => {
    const original = loadSample('png', 'novelai-full.png');

    expect(await parse(original)).toEqual(read(original));
  });

  it('does not recover stealth data from WebP (pixel decoding is PNG-only)', async () => {
    // forge-stealth-*.webp are lossless (VP8L), so the stealth bits do
    // survive in the pixel data — but reading them would require a full
    // WebP decoder, which is out of scope for a dependency-free
    // library. Once the EXIF metadata is stripped, nothing is
    // recoverable.
    const original = loadSample('webp', 'forge-stealth-alpha-comp.webp');
    expect(read(original).status).toBe('success');

    const strippedResult = write(original, { status: 'empty' });
    expect(strippedResult.ok).toBe(true);
    if (!strippedResult.ok) {
      return;
    }

    expect((await parse(strippedResult.value)).status).toBe('empty');
  });
});
