import { describe, expect, it } from 'vitest';
import { detectC2paVendor } from '../../../src/parsers/c2pa';

const DST_PREFIX = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
const AI_DST = `${DST_PREFIX}trainedAlgorithmicMedia`;

// ============================================================================
// Byte builders
// ============================================================================

const encode = (value: string): number[] => [
  ...new TextEncoder().encode(value),
];

const uint32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

/**
 * Encode a CBOR text string (major type 3) with a 1-byte length header,
 * the encoding real manifests use for DigitalSourceType URIs.
 */
function cborText(value: string): number[] {
  const bytes = encode(value);
  return [0x78, bytes.length, ...bytes];
}

/**
 * Encode a short CBOR text string (inline length, under 24 bytes).
 * The header byte 0x60 + length lands in the ASCII letter range.
 */
function cborShortText(value: string): number[] {
  const bytes = encode(value);
  return [0x60 + bytes.length, ...bytes];
}

/** An ISO BMFF style box: 4-byte length, 4-byte type, content. */
function box(type: string, content: number[]): number[] {
  return [...uint32(8 + content.length), ...encode(type), ...content];
}

/**
 * A JUMBF superbox: a `jumd` description box carrying the label (16-byte
 * content type UUID, toggles with the label bit set, null-terminated label),
 * followed by the child boxes.
 */
function jumb(label: string, children: number[][]): number[] {
  const description = [...new Array(16).fill(0), 0x03, ...encode(label), 0];
  return box('jumb', [...box('jumd', description), ...children.flat()]);
}

/** One action of a `c2pa.actions` assertion, as the CBOR text it contains. */
interface Action {
  action: string;
  softwareAgent?: string | { name: string; version?: string };
  digitalSourceType?: string;
}

function encodeActions(actions: Action[]): number[] {
  return actions.flatMap(({ action, softwareAgent, digitalSourceType }) => {
    const bytes = [...cborShortText('action'), ...cborShortText(action)];
    if (typeof softwareAgent === 'string') {
      bytes.push(
        ...cborShortText('softwareAgent'),
        ...cborShortText(softwareAgent),
      );
    } else if (softwareAgent) {
      const entries = [
        ...cborShortText('name'),
        ...cborShortText(softwareAgent.name),
      ];
      if (softwareAgent.version) {
        entries.push(
          ...cborShortText('version'),
          ...cborShortText(softwareAgent.version),
        );
      }
      const size = softwareAgent.version ? 2 : 1;
      bytes.push(...cborShortText('softwareAgent'), 0xa0 + size, ...entries);
    }
    if (digitalSourceType) {
      bytes.push(
        ...cborShortText('digitalSourceType'),
        ...cborText(digitalSourceType),
      );
    }
    return bytes;
  });
}

/** One manifest: assertions (actions plus extras), claim and signature. */
function manifest(options: {
  claimGenerator?: string;
  signer?: string;
  actions?: Action[];
  extraAssertions?: number[][];
}): number[] {
  const assertions = [
    ...(options.actions
      ? [jumb('c2pa.actions.v2', [box('cbor', encodeActions(options.actions))])]
      : []),
    ...(options.extraAssertions ?? []),
  ];
  return jumb('urn:c2pa:00000000-0000-0000-0000-000000000000', [
    jumb('c2pa.assertions', assertions),
    jumb('c2pa.claim.v2', [
      box('cbor', [
        ...cborShortText('claim_generator_info'),
        ...cborShortText(options.claimGenerator ?? 'Some Generator'),
      ]),
    ]),
    jumb('c2pa.signature', [
      box('cbor', encode(options.signer ?? 'CN=Some CA')),
    ]),
  ]);
}

/** A manifest store: the `c2pa` superbox holding the manifests, oldest first. */
function store(...manifests: number[][]): number[] {
  return jumb('c2pa', manifests);
}

/**
 * Wrap manifest bytes in a minimal PNG whose only chunk is `caBX`.
 * CRCs are placeholders: detection does not verify them.
 */
function pngWithCaBX(bytes: number[]): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const caBX = [
    ...uint32(bytes.length),
    ...encode('caBX'),
    ...bytes,
    0,
    0,
    0,
    0,
  ];
  const iend = [...uint32(0), ...encode('IEND'), 0xae, 0x42, 0x60, 0x82];
  return new Uint8Array([...signature, ...caBX, ...iend]);
}

/** A JPEG APP11 segment carrying one JUMBF packet. */
function app11(
  instance: number,
  sequence: number,
  payload: number[],
): number[] {
  const body = [
    0x4a,
    0x50,
    instance >> 8,
    instance & 0xff,
    ...uint32(sequence),
    ...payload,
  ];
  const length = body.length + 2;
  return [0xff, 0xeb, length >> 8, length & 0xff, ...body];
}

/** A minimal JPEG: SOI, the given segments, then SOS and EOI. */
function jpeg(...segments: number[][]): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    ...segments.flat(),
    0xff,
    0xda,
    0x00,
    0x02,
    0xff,
    0xd9,
  ]);
}

// ============================================================================
// Tests
// ============================================================================

describe('detectC2paVendor - DigitalSourceType', () => {
  // These manifests are flat CBOR without JUMBF boxes, which exercises the
  // fallback that scans the whole store as one manifest.

  it('stops at the CBOR string length when the next map key starts with a letter', () => {
    // Shape of a Sora manifest: the DST value is immediately followed by the
    // key "allActionsIncluded", whose header byte 0x72 reads as 'r'.
    const png = pngWithCaBX([
      ...cborShortText('digitalSourceType'),
      ...cborText(AI_DST),
      ...cborShortText('allActionsIncluded'),
      0xf5, // true
    ]);

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'unknown',
      source: 'c2pa',
    });
  });

  it('does not flag a non-AI source type bounded the same way', () => {
    const png = pngWithCaBX([
      ...cborShortText('digitalSourceType'),
      ...cborText(`${DST_PREFIX}digitalCapture`),
      ...cborShortText('when'),
    ]);

    expect(detectC2paVendor(png, 'png')).toBeNull();
  });

  it('ignores a header-like byte pair that would cut into the URI', () => {
    // 0x78 0x05 looks like a 1-byte CBOR header, but a 5-byte string cannot
    // hold the URI, so it is not the URI's own header.
    const png = pngWithCaBX([0x78, 0x05, ...encode(AI_DST), 0x3c]);

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'unknown',
      source: 'c2pa',
    });
  });

  it('still reads a URI that is not CBOR-encoded (e.g. embedded XMP)', () => {
    const xmp = `<Iptc4xmpExt:DigitalSourceType>${AI_DST}</Iptc4xmpExt:DigitalSourceType>`;

    expect(detectC2paVendor(pngWithCaBX(encode(xmp)), 'png')).toEqual({
      vendor: 'unknown',
      source: 'c2pa',
    });
  });
});

describe('detectC2paVendor - vendor and product', () => {
  it('names a known vendor even without an AI DigitalSourceType', () => {
    const png = pngWithCaBX(
      store(manifest({ claimGenerator: 'OpenAI Media Service API' })),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'openai',
      source: 'c2pa',
    });
  });

  it('returns null for a manifest with neither an AI declaration nor a known vendor', () => {
    // A camera or a non-AI editor: Content Credentials, but not a vendor image.
    const png = pngWithCaBX(
      store(
        manifest({
          actions: [
            {
              action: 'c2pa.created',
              digitalSourceType: `${DST_PREFIX}digitalCapture`,
            },
          ],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toBeNull();
  });

  it('reads a software agent written as a text string (Grok Imagine)', () => {
    const png = pngWithCaBX(
      store(
        manifest({
          claimGenerator: 'Grok Imagine',
          signer: 'CN=xAI Grok Imagine',
          actions: [
            {
              action: 'c2pa.created',
              softwareAgent: 'Grok Imagine',
              digitalSourceType: AI_DST,
            },
          ],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'xai',
      product: 'Grok Imagine',
      source: 'c2pa',
    });
  });

  it('reads the name of a software agent written as a map (ChatGPT)', () => {
    const png = pngWithCaBX(
      store(
        manifest({
          claimGenerator: 'OpenAI Media Service API',
          actions: [
            {
              action: 'c2pa.created',
              softwareAgent: { name: 'ChatGPT', version: 'gpt-image' },
              digitalSourceType: AI_DST,
            },
            { action: 'c2pa.converted' },
          ],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'openai',
      product: 'ChatGPT',
      source: 'c2pa',
    });
  });

  it('takes the software agent of the created action only', () => {
    const png = pngWithCaBX(
      store(
        manifest({
          claimGenerator: 'Google C2PA Core Generator Library',
          actions: [
            { action: 'c2pa.created', digitalSourceType: AI_DST },
            { action: 'c2pa.edited', softwareAgent: 'Some Editor' },
          ],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'google',
      source: 'c2pa',
    });
  });
});

describe('detectC2paVendor - multiple manifests', () => {
  const openai = (actions: Action[]) =>
    manifest({ claimGenerator: 'OpenAI Media Service API', actions });

  it('attributes an image created again from an ingredient to the newer creator', () => {
    // Shape of an image generated with ChatGPT and then edited in Gemini:
    // both manifests declare c2pa.created. The Google manifest's ingredient
    // assertion mentions OpenAI, which must not leak into the attribution.
    const png = pngWithCaBX(
      store(
        openai([
          {
            action: 'c2pa.created',
            softwareAgent: { name: 'ChatGPT' },
            digitalSourceType: AI_DST,
          },
        ]),
        manifest({
          claimGenerator: 'Google C2PA Core Generator Library',
          signer: 'CN=Google LLC',
          actions: [
            { action: 'c2pa.created', digitalSourceType: AI_DST },
            { action: 'c2pa.edited' },
          ],
          extraAssertions: [
            jumb('c2pa.ingredient.v3', [
              box('cbor', encode('OpenAI Media Service API')),
            ]),
          ],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'google',
      source: 'c2pa',
    });
  });

  it('keeps the original creator when a later tool edits without creating', () => {
    const png = pngWithCaBX(
      store(
        openai([
          {
            action: 'c2pa.created',
            softwareAgent: { name: 'ChatGPT' },
            digitalSourceType: AI_DST,
          },
        ]),
        manifest({
          actions: [{ action: 'c2pa.opened' }, { action: 'c2pa.edited' }],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'openai',
      product: 'ChatGPT',
      source: 'c2pa',
    });
  });

  it('falls back to the active manifest when none declares c2pa.created', () => {
    const png = pngWithCaBX(
      store(
        openai([{ action: 'c2pa.edited', digitalSourceType: AI_DST }]),
        manifest({
          claimGenerator: 'Google C2PA Core Generator Library',
          actions: [{ action: 'c2pa.edited' }],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'google',
      source: 'c2pa',
    });
  });

  it('accepts an AI declaration found only outside the creating manifest', () => {
    // A new image composed by an unknown tool from an AI-generated
    // ingredient: the creating (newest created) manifest declares the non-AI
    // `composite`, only the ingredient manifest declares AI generation.
    const png = pngWithCaBX(
      store(
        manifest({
          actions: [{ action: 'c2pa.created', digitalSourceType: AI_DST }],
        }),
        manifest({
          actions: [
            {
              action: 'c2pa.created',
              digitalSourceType: `${DST_PREFIX}composite`,
            },
          ],
        }),
      ),
    );

    expect(detectC2paVendor(png, 'png')).toEqual({
      vendor: 'unknown',
      source: 'c2pa',
    });
  });
});

describe('detectC2paVendor - JPEG APP11', () => {
  const grok = store(
    manifest({
      claimGenerator: 'Grok Imagine',
      actions: [
        {
          action: 'c2pa.created',
          softwareAgent: 'Grok Imagine',
          digitalSourceType: AI_DST,
        },
      ],
    }),
  );
  const expected = { vendor: 'xai', product: 'Grok Imagine', source: 'c2pa' };

  it('reads a store held in one APP11 segment', () => {
    expect(detectC2paVendor(jpeg(app11(1, 1, grok)), 'jpeg')).toEqual(expected);
  });

  it('joins a store split across APP11 segments, in packet order', () => {
    // Every continuation packet repeats the 8-byte header of the box it
    // continues; the packets are written out of order on purpose.
    const header = grok.slice(0, 8);
    const middle = Math.floor(grok.length / 2);
    const first = app11(1, 1, grok.slice(0, middle));
    const second = app11(1, 2, [...header, ...grok.slice(middle)]);

    expect(detectC2paVendor(jpeg(second, first), 'jpeg')).toEqual(expected);
  });

  it('ignores a JUMBF instance that is not a C2PA store', () => {
    const other = jumb('not-c2pa', [box('cbor', encode('Grok Imagine'))]);
    expect(detectC2paVendor(jpeg(app11(1, 1, other)), 'jpeg')).toBeNull();
  });

  it('does not read C2PA from WebP', () => {
    expect(detectC2paVendor(pngWithCaBX(grok), 'webp')).toBeNull();
  });
});
