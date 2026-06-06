import { describe, expect, it } from 'vitest';
import { read } from '../../src/index';
import {
  C2PA_PNG_SAMPLES,
  loadC2paSample,
  loadSample,
} from '../helpers/samples';

/**
 * Expected shape of the `c2pa` ParseResult variant, asserted structurally so
 * these sample tests double as documentation of exactly what a consumer
 * receives from read(). Mirrors the public `C2paMetadata` type (src/types.ts).
 */
interface ExpectedC2paResult {
  status: 'c2pa';
  c2pa: {
    /** Coarse vendor attribution. Per-model (e.g. Imagen vs Nano Banana) is not recoverable. */
    vendor: 'openai' | 'google' | 'unknown';
    /** True when the manifest declares a trained-algorithmic (AI-generated) digitalSourceType. */
    aiGenerated: boolean;
    /** Raw IPTC DigitalSourceType URI, surfaced verbatim. */
    digitalSourceType?: string;
    /** C2PA claim_generator_info.name — present for both vendors. */
    claimGenerator?: string;
  };
}

/** The IPTC concept-id used by every "fully AI-generated" asset (cross-vendor). */
const DST_TRAINED_ALGORITHMIC_MEDIA =
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

describe('C2PA Content Credentials detection - real samples', () => {
  // --- What a consumer receives from read() for an OpenAI / ChatGPT image. ---
  it('chatgpt-image2.png -> OpenAI Content Credentials', () => {
    const result = read(loadC2paSample('png', 'chatgpt-image2.png'));

    expect(result.status).toBe('c2pa');

    const { c2pa } = result as unknown as ExpectedC2paResult;
    expect(c2pa).toEqual({
      vendor: 'openai',
      aiGenerated: true,
      digitalSourceType: DST_TRAINED_ALGORITHMIC_MEDIA,
      claimGenerator: 'OpenAI Media Service API',
    });
  });

  // --- Google / Gemini image. ---
  // gemini_3.1pro and gemini_unknown carry structurally IDENTICAL manifests
  // (differing only in urn:uuid + cert serial), proving the model is NOT
  // distinguishable from metadata — we expose vendor only.
  it('gemini_3.1pro.png -> Google Content Credentials (coarse vendor only)', () => {
    const result = read(loadC2paSample('png', 'gemini_3.1pro.png'));

    expect(result.status).toBe('c2pa');

    const { c2pa } = result as unknown as ExpectedC2paResult;
    expect(c2pa).toEqual({
      vendor: 'google',
      aiGenerated: true,
      digitalSourceType: DST_TRAINED_ALGORITHMIC_MEDIA,
      claimGenerator: 'Google C2PA Core Generator Library',
    });
  });

  it('gemini_unknown.png -> same c2pa shape as gemini_3.1pro.png', () => {
    const result = read(loadC2paSample('png', 'gemini_unknown.png'));

    expect(result.status).toBe('c2pa');

    const { c2pa } = result as unknown as ExpectedC2paResult;
    expect(c2pa).toEqual({
      vendor: 'google',
      aiGenerated: true,
      digitalSourceType: DST_TRAINED_ALGORITHMIC_MEDIA,
      claimGenerator: 'Google C2PA Core Generator Library',
    });
  });

  // --- Data-driven contract over every C2PA fixture. ---
  for (const { filename, vendor } of C2PA_PNG_SAMPLES) {
    it(`${filename} -> status 'c2pa', vendor '${vendor}', flagged AI-generated`, () => {
      const result = read(loadC2paSample('png', filename));

      expect(result.status).toBe('c2pa');

      const { c2pa } = result as unknown as ExpectedC2paResult;
      expect(c2pa.vendor).toBe(vendor);
      expect(c2pa.aiGenerated).toBe(true);
    });
  }
});

describe('C2PA detection - no regressions / no false positives', () => {
  // A normal SD-tool image must keep returning generation metadata.
  it('sd-webui.png still parses as generation metadata (status success)', () => {
    const result = read(loadSample('png', 'sd-webui.png'));
    expect(result.status).toBe('success');
  });

  // A plain non-AI PNG (no C2PA box) must NOT be flagged as c2pa.
  it('gimp.png (no Content Credentials) is not flagged as c2pa', () => {
    const result = read(loadSample('png', 'gimp.png'));
    expect(result.status).not.toBe('c2pa');
  });
});
