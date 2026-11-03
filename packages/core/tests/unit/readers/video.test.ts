import { describe, expect, it } from 'vitest';
import { parseVideo, type VideoParseResult } from '../../../src/index';

// ============================================================================
// Byte builders
// ============================================================================

const encode = (value: string): number[] => [
  ...new TextEncoder().encode(value),
];
const latin1 = (value: string): number[] =>
  [...value].map((c) => c.charCodeAt(0));

const uint32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

/** An ISO BMFF box; the type is 4 latin-1 characters or 4 raw bytes. */
function box(type: string | number[], content: number[]): number[] {
  const typeBytes = typeof type === 'string' ? latin1(type) : type;
  return [...uint32(8 + content.length), ...typeBytes, ...content];
}

/** A box with a 64-bit size (size field 1). */
function largeBox(type: string, content: number[]): number[] {
  const size = 16 + content.length;
  return [
    ...uint32(1),
    ...latin1(type),
    ...uint32(0),
    ...uint32(size),
    ...content,
  ];
}

const ftyp = (brand = 'isom') =>
  box('ftyp', [...latin1(brand), ...uint32(0x200), ...latin1('isomiso2')]);

/** A `data` box: type indicator (1 = UTF-8), locale, value. */
const data = (value: string, type = 1) =>
  box('data', [...uint32(type), ...uint32(0), ...encode(value)]);

/** `udta/meta` with mdta keys; `fullBox` false gives the QuickTime form. */
function mdtaMeta(tags: Record<string, string>, fullBox = true): number[] {
  const names = Object.keys(tags);
  const hdlr = box('hdlr', [
    ...uint32(0),
    ...uint32(0),
    ...latin1('mdta'),
    ...new Array(13).fill(0),
  ]);
  const keys = box('keys', [
    ...uint32(0),
    ...uint32(names.length),
    ...names.flatMap((name) => [
      ...uint32(8 + encode(name).length),
      ...latin1('mdta'),
      ...encode(name),
    ]),
  ]);
  const ilst = box(
    'ilst',
    names.flatMap((name, i) => box(uint32(i + 1), data(tags[name] ?? ''))),
  );
  return box('meta', [
    ...(fullBox ? uint32(0) : []),
    ...hdlr,
    ...keys,
    ...ilst,
  ]);
}

/** `udta/meta` with an atom-typed ilst (iTunes style). */
function itunesMeta(items: [string, number[]][]): number[] {
  const hdlr = box('hdlr', [
    ...uint32(0),
    ...uint32(0),
    ...latin1('mdir'),
    ...new Array(13).fill(0),
  ]);
  const ilst = box(
    'ilst',
    items.flatMap(([type, value]) => box(type, value)),
  );
  return box('meta', [...uint32(0), ...hdlr, ...ilst]);
}

/** A QuickTime `udta` text item: length, language, text. */
function quickTimeText(type: string, text: string): number[] {
  const bytes = encode(text);
  return box(type, [
    bytes.length >> 8,
    bytes.length & 0xff,
    0x55,
    0xc4,
    ...bytes,
  ]);
}

/** A video track of the given size. */
function videoTrak(width: number, height: number): number[] {
  const tkhd = box('tkhd', [
    ...new Array(76).fill(0),
    ...uint32(width * 0x10000),
    ...uint32(height * 0x10000),
  ]);
  const hdlr = box('hdlr', [
    ...uint32(0),
    ...latin1('mhlr'),
    ...latin1('vide'),
    ...new Array(13).fill(0),
  ]);
  return box('trak', [...tkhd, ...box('mdia', hdlr)]);
}

/** A uuid box with a 16-byte user type given as hex. */
const uuid = (userType: string, body: number[]) =>
  box('uuid', [
    ...(userType.match(/../g) ?? []).map((h) => Number.parseInt(h, 16)),
    ...body,
  ]);

const C2PA_UUID = 'd8fec3d61b0e483c92975828877ec481';
const XMP_UUID = 'be7acfcb97a942e89c71999491e3afac';

// --- JUMBF (C2PA store), as in tests/unit/parsers/c2pa.test.ts ---

function jumb(label: string, children: number[][]): number[] {
  const description = [...new Array(16).fill(0), 0x03, ...encode(label), 0];
  return box('jumb', [...box('jumd', description), ...children.flat()]);
}

const cborShortText = (value: string) => [
  0x60 + encode(value).length,
  ...encode(value),
];

/** A C2PA store with one manifest created by `agent`, signed by `signer`. */
function c2paStore(agent: string, signer: string): number[] {
  const actions = [
    ...cborShortText('action'),
    ...cborShortText('c2pa.created'),
    ...cborShortText('softwareAgent'),
    0xa1,
    ...cborShortText('name'),
    ...cborShortText(agent),
  ];
  return jumb('c2pa', [
    jumb('urn:c2pa:00000000-0000-0000-0000-000000000000', [
      jumb('c2pa.assertions', [
        jumb('c2pa.actions.v2', [box('cbor', actions)]),
      ]),
      jumb('c2pa.claim.v2', [box('cbor', encode(agent))]),
      jumb('c2pa.signature', [box('cbor', encode(signer))]),
    ]),
  ]);
}

/** The C2PA uuid body: FullBox header, purpose, 8-byte offset, store. */
const c2paUuid = (store: number[], purpose = 'manifest') =>
  uuid(C2PA_UUID, [
    ...uint32(0),
    ...latin1(purpose),
    0,
    ...new Array(8).fill(0),
    ...store,
  ]);

const mp4 = (...boxes: number[][]) => new Uint8Array(boxes.flat());

// --- EBML ---

function ebmlId(id: number): number[] {
  const bytes: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return bytes;
}

/** An EBML element with an 8-byte size; `null` writes an unknown size. */
function element(
  id: number,
  content: number[] | null,
  unknownSize = false,
): number[] {
  const body = content ?? [];
  const size = unknownSize
    ? [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
    : [
        0x01,
        0,
        0,
        ...uint32(Math.floor(body.length / 2 ** 32) & 0xff).slice(3),
        ...uint32(body.length),
      ];
  return [...ebmlId(id), ...size, ...body];
}

const uint = (id: number, value: number) => element(id, uint32(value));
const str = (id: number, value: string) => element(id, encode(value));

const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;

const ebmlHeader = (docType: string) => element(EBML, str(0x4282, docType));

/** A Tag with SimpleTags; `trackUid` narrows it to a track. */
function tag(tags: Record<string, string>, trackUid?: number): number[] {
  const targets = element(
    0x63c0,
    trackUid === undefined ? [] : uint(0x63c5, trackUid),
  );
  const simpleTags = Object.entries(tags).flatMap(([name, value]) =>
    element(0x67c8, [...str(0x45a3, name), ...str(0x4487, value)]),
  );
  return element(0x7373, [...targets, ...simpleTags]);
}

const tagsElement = (...tagElements: number[][]) =>
  element(0x1254c367, tagElements.flat());

const tracks = (width: number, height: number) =>
  element(
    0x1654ae6b,
    element(0xae, [
      ...uint(0x83, 1),
      ...element(0xe0, [...uint(0xb0, width), ...uint(0xba, height)]),
    ]),
  );

const cluster = (unknownSize = false) =>
  element(0x1f43b675, unknownSize ? null : [0xa3, 0x81, 0x00], unknownSize);

/** A SeekHead pointing at one element, by position from the Segment data. */
const seekHead = (id: number, position: number) =>
  element(
    0x114d9b74,
    element(0x4dbb, [
      ...element(0x53ab, ebmlId(id)),
      ...uint(0x53ac, position),
    ]),
  );

// ============================================================================
// Helpers
// ============================================================================

function expectRaw(result: VideoParseResult) {
  if (result.status !== 'unrecognized' && result.status !== 'success') {
    throw new Error(`no raw metadata: ${result.status}`);
  }
  return result.raw;
}

// ============================================================================
// MP4
// ============================================================================

describe('parseVideo - MP4 boxes', () => {
  it('reads mdta keys from an ISO (FullBox) meta', async () => {
    const result = await parseVideo(
      mp4(ftyp(), box('moov', box('udta', mdtaMeta({ custom: 'value' })))),
    );
    expect(expectRaw(result)).toEqual({
      format: 'mp4',
      tags: [{ key: 'custom', value: 'value', source: 'mdta' }],
    });
  });

  it('reads mdta keys from a QuickTime meta without version and flags', async () => {
    const result = await parseVideo(
      mp4(
        ftyp(),
        box('moov', box('udta', mdtaMeta({ custom: 'value' }, false))),
      ),
    );
    expect(expectRaw(result).tags).toEqual([
      { key: 'custom', value: 'value', source: 'mdta' },
    ]);
  });

  it('reads atom-typed ilst items and QuickTime text items', async () => {
    const udta = box('udta', [
      ...itunesMeta([['©cmt', data('a comment')]]),
      ...quickTimeText('©xyz', 'quicktime text'),
    ]);
    const result = await parseVideo(mp4(ftyp(), box('moov', udta)));
    expect(expectRaw(result).tags).toEqual([
      { key: '©cmt', value: 'a comment', source: 'itunes' },
      { key: '©xyz', value: 'quicktime text', source: 'quicktime' },
    ]);
  });

  it('leaves out values that are not UTF-8 text (e.g. cover art)', async () => {
    const udta = box(
      'udta',
      itunesMeta([
        ['covr', data('ÿØ', 13)],
        ['desc', data('kept')],
      ]),
    );
    const result = await parseVideo(mp4(ftyp(), box('moov', udta)));
    expect(expectRaw(result).tags).toEqual([
      { key: 'desc', value: 'kept', source: 'itunes' },
    ]);
  });

  it('reads moov after a 64-bit mdat and names a qt brand mov', async () => {
    const result = await parseVideo(
      mp4(
        ftyp('qt  '),
        largeBox('mdat', [1, 2, 3, 4]),
        box('moov', box('udta', mdtaMeta({ custom: 'value' }))),
      ),
    );
    expect(expectRaw(result).format).toBe('mov');
    expect(expectRaw(result).tags).toHaveLength(1);
  });

  it('reads a box whose size 0 runs to the end of the file', async () => {
    const moov = box('moov', box('udta', mdtaMeta({ custom: 'value' })));
    const toEnd = [...uint32(0), ...moov.slice(4)];
    expect(expectRaw(await parseVideo(mp4(ftyp(), toEnd))).tags).toHaveLength(
      1,
    );
  });

  it('treats encoder-only tags as no metadata', async () => {
    const udta = box('udta', [
      ...mdtaMeta({ major_brand: 'isom', encoder: 'Lavf61.7.100' }),
      ...quickTimeText('©swr', 'Lavf61.7.100'),
    ]);
    expect(await parseVideo(mp4(ftyp(), box('moov', udta)))).toEqual({
      status: 'empty',
    });
  });

  it('skips a body larger than 16 MB instead of reading it', async () => {
    // Built as one typed array: spreading 16 MB of numbers is slow enough
    // to time out under load.
    const meta = mdtaMeta({ custom: 'value' });
    const free = 16 * 1024 * 1024;
    const udtaSize = 8 + meta.length + 8 + free;
    const head = [
      ...ftyp(),
      ...uint32(8 + udtaSize),
      ...latin1('moov'),
      ...uint32(udtaSize),
      ...latin1('udta'),
      ...meta,
      ...uint32(8 + free),
      ...latin1('free'),
    ];
    const file = new Uint8Array(head.length + free);
    file.set(head);
    expect(await parseVideo(file)).toEqual({ status: 'empty' });
  });

  it('does not throw on a truncated file', async () => {
    const whole = mp4(
      ftyp(),
      box('moov', box('udta', mdtaMeta({ custom: 'value' }))),
    );
    // Cut inside ftyp: the container cannot be identified.
    expect(await parseVideo(whole.subarray(0, 12))).toEqual({
      status: 'invalid',
      message: 'Unknown video format',
    });
    // Cut inside moov: the box overruns the file and is not read.
    for (const length of [40, whole.length - 5]) {
      const result = await parseVideo(whole.subarray(0, length));
      expect(result).toEqual({ status: 'empty' });
    }
  });

  it('takes missing dimensions from the video track', async () => {
    // A ComfyUI graph without a size node: the track size fills in.
    const prompt = JSON.stringify({
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'a fox' } },
      '2': {
        class_type: 'KSampler',
        inputs: {
          seed: 1,
          steps: 4,
          cfg: 1,
          sampler_name: 'euler',
          scheduler: 'simple',
          positive: ['1', 0],
          negative: ['1', 0],
        },
      },
    });
    const file = mp4(
      ftyp(),
      box('moov', [
        ...videoTrak(640, 360),
        ...box('udta', mdtaMeta({ prompt })),
      ]),
    );
    const result = await parseVideo(file);
    if (result.status !== 'success') throw new Error(result.status);
    expect([result.metadata.width, result.metadata.height]).toEqual([640, 360]);
  });
});

describe('parseVideo - MP4 vendor declarations', () => {
  it('reads a C2PA store from the uuid box (Sora shape)', async () => {
    // Sora signs through "Truepic Lens CLI in Sora" and declares "Sora".
    const file = mp4(
      ftyp(),
      c2paUuid(c2paStore('Sora', 'CN=Truepic Lens CLI in Sora, O=OpenAI')),
      box('moov', []),
    );
    expect(await parseVideo(file)).toEqual({
      status: 'vendor',
      info: {
        vendor: 'openai',
        product: 'Sora',
        source: 'c2pa',
        media: 'video',
      },
    });
  });

  it('ignores a C2PA uuid box whose purpose is not "manifest"', async () => {
    const file = mp4(
      ftyp(),
      c2paUuid(c2paStore('Sora', 'CN=Truepic Lens CLI in Sora'), 'merkle'),
      box('moov', []),
    );
    expect(await parseVideo(file)).toEqual({ status: 'empty' });
  });

  it('reads an XMP uuid box after the media data', async () => {
    const xmp =
      '<x:xmpmeta><rdf:Description iptcExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"><dc:publisher><rdf:Bag><rdf:li>Meta</rdf:li></rdf:Bag></dc:publisher></rdf:Description></x:xmpmeta>';
    const file = mp4(
      ftyp(),
      box('moov', []),
      box('mdat', [0, 0]),
      uuid(XMP_UUID, encode(xmp)),
    );
    expect(await parseVideo(file)).toEqual({
      status: 'vendor',
      info: { vendor: 'meta', source: 'xmp', media: 'video' },
    });
  });

  it("reads xAI's signature from ©cmt (older Grok shape)", async () => {
    const signature = Buffer.from(new Array(128).fill(7)).toString('base64');
    const udta = box(
      'udta',
      itunesMeta([['©cmt', data(`Signature: ${signature}`)]]),
    );
    expect(await parseVideo(mp4(ftyp(), box('moov', udta)))).toEqual({
      status: 'vendor',
      info: { vendor: 'xai', source: 'signature', media: 'video' },
    });
  });

  it('keeps a too-short signature as unrecognized metadata', async () => {
    const signature = Buffer.from(new Array(64).fill(7)).toString('base64');
    const udta = box(
      'udta',
      itunesMeta([['©cmt', data(`Signature: ${signature}`)]]),
    );
    expect((await parseVideo(mp4(ftyp(), box('moov', udta)))).status).toBe(
      'unrecognized',
    );
  });
});

// ============================================================================
// Matroska
// ============================================================================

describe('parseVideo - Matroska elements', () => {
  it('reads whole-file tags and skips per-track tags', async () => {
    const file = new Uint8Array([
      ...ebmlHeader('webm'),
      ...element(SEGMENT, [
        ...tagsElement(tag({ CUSTOM: 'value' }), tag({ ENCODER: 'libvpx' }, 1)),
      ]),
    ]);
    expect(expectRaw(await parseVideo(file))).toEqual({
      format: 'webm',
      tags: [{ key: 'CUSTOM', value: 'value', source: 'matroska' }],
    });
  });

  it('names a matroska DocType mkv', async () => {
    const file = new Uint8Array([
      ...ebmlHeader('matroska'),
      ...element(SEGMENT, tagsElement(tag({ CUSTOM: 'value' }))),
    ]);
    expect(expectRaw(await parseVideo(file)).format).toBe('mkv');
  });

  it('follows the SeekHead to Tags written after the clusters', async () => {
    const head = seekHead(0x1254c367, 0); // patched below
    const clusters = cluster();
    const tagsBytes = tagsElement(tag({ CUSTOM: 'after clusters' }));
    const position = head.length + clusters.length;
    const segmentData = [
      ...seekHead(0x1254c367, position),
      ...clusters,
      ...tagsBytes,
    ];
    const file = new Uint8Array([
      ...ebmlHeader('webm'),
      ...element(SEGMENT, segmentData),
    ]);
    expect(expectRaw(await parseVideo(file)).tags).toEqual([
      { key: 'CUSTOM', value: 'after clusters', source: 'matroska' },
    ]);
  });

  it('handles an unknown-size Segment and Cluster', async () => {
    const head = seekHead(0x1254c367, 0);
    const position = head.length + cluster(true).length;
    const segmentData = [
      ...seekHead(0x1254c367, position),
      ...cluster(true),
      ...tagsElement(tag({ CUSTOM: 'value' })),
    ];
    const file = new Uint8Array([
      ...ebmlHeader('webm'),
      ...element(SEGMENT, segmentData, true),
    ]);
    expect(expectRaw(await parseVideo(file)).tags).toHaveLength(1);
  });

  it('takes missing dimensions from the video track', async () => {
    const prompt = JSON.stringify({
      '1': { class_type: 'CLIPTextEncode', inputs: { text: 'a fox' } },
      '2': {
        class_type: 'KSampler',
        inputs: {
          seed: 1,
          steps: 4,
          cfg: 1,
          sampler_name: 'euler',
          scheduler: 'simple',
          positive: ['1', 0],
          negative: ['1', 0],
        },
      },
    });
    const file = new Uint8Array([
      ...ebmlHeader('webm'),
      ...element(SEGMENT, [
        ...tracks(1280, 720),
        ...tagsElement(tag({ PROMPT: prompt })),
      ]),
    ]);
    const result = await parseVideo(file);
    if (result.status !== 'success') throw new Error(result.status);
    expect([result.metadata.width, result.metadata.height]).toEqual([
      1280, 720,
    ]);
  });

  it('rejects an EBML file of another DocType', async () => {
    const file = new Uint8Array([
      ...ebmlHeader('other'),
      ...element(SEGMENT, []),
    ]);
    expect(await parseVideo(file)).toEqual({
      status: 'invalid',
      message: 'Unknown video format',
    });
  });
});

describe('parseVideo - input', () => {
  it('rejects a file that is not a video', async () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(await parseVideo(png)).toEqual({
      status: 'invalid',
      message: 'Unknown video format',
    });
  });

  it('accepts an ArrayBuffer', async () => {
    const file = mp4(
      ftyp(),
      box('moov', box('udta', mdtaMeta({ custom: 'value' }))),
    );
    const result = await parseVideo(file.buffer.slice(0));
    expect(expectRaw(result).tags).toHaveLength(1);
  });
});
